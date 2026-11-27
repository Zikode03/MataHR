require('./register-typescript.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const m = require('../src/features/organisation/model.ts');
function fixture() {
  return {
    employees: [
      ['ceo', 'Director'],
      ['manager', 'Manager'],
      ['developer', 'Developer'],
      ['new', 'New starter'],
    ].map(([id, name]) => ({
      id,
      values: [id, name, 'Technology', 'Developer', 'Permanent', '2020-01-01'],
      status: 'Active',
    })),
    org: {
      branches: [{ id: 'branch', name: 'Office', address: '' }],
      departments: [{ id: 'department', name: 'Technology', branch: 'branch' }],
      positions: [{ id: 'position', name: 'Developer', department: 'department' }],
      assignments: [
        { employee: 'ceo', position: 'position', manager: '' },
        { employee: 'manager', position: 'position', manager: 'ceo' },
        { employee: 'developer', position: 'position', manager: 'manager' },
      ],
    },
  };
}
test('chart layout includes assigned people with managers above their reports', () => {
  const { org, employees } = fixture(),
    layout = m.chartLayout(org, employees);
  assert.equal(layout.nodes.length, 3);
  assert.equal(layout.edges.length, 3);
  for (const node of layout.nodes) {
    const manager = layout.nodes.find((other) => other.id === node.manager);
    if (manager) assert(node.y > manager.y + m.CARD_HEIGHT);
  }
  assert(!layout.nodes.some((node) => node.id === 'new'));
});
test('chart excludes exited and future employees', () => {
  const { employees } = fixture();
  employees[0].status = 'Exited';
  employees[1].values[5] = '2999-01-01';
  assert.deepEqual(
    m.currentPeople(employees).map((e) => e.id),
    ['developer', 'new'],
  );
});
test('free card movement preserves reporting relationships', () => {
  const { org, employees } = fixture(),
    next = m.moveChartPerson(org, employees, 'developer', { x: 700, y: 600 });
  assert.deepEqual(next.assignments, org.assignments);
  assert.equal(m.chartLayout(next, employees).nodes.find((n) => n.id === 'developer').x, 700);
  assert.equal(m.chartLayout(next, employees).nodes.find((n) => n.id === 'developer').y, 600);
  assert(!org.chartLayout);
});
test('moving a team preserves relative card positions', () => {
  const { org, employees } = fixture(),
    before = m.chartLayout(org, employees),
    after = m.chartLayout(
      m.moveChartPerson(org, employees, 'manager', { x: 800, y: 800 }, true),
      employees,
    );
  for (const axis of ['x', 'y'])
    assert.equal(
      before.nodes.find((n) => n.id === 'developer')[axis] -
        before.nodes.find((n) => n.id === 'manager')[axis],
      after.nodes.find((n) => n.id === 'developer')[axis] -
        after.nodes.find((n) => n.id === 'manager')[axis],
    );
});
test('manual connections preserve card positions and reject reporting cycles', () => {
  const { org, employees } = fixture(),
    before = m.chartLayout(org, employees),
    next = m.connectChartPeople(org, employees, 'ceo', 'developer'),
    after = m.chartLayout(next, employees);
  assert.equal(next.assignments.find((a) => a.employee === 'developer').manager, 'ceo');
  for (const node of before.nodes) {
    const moved = after.nodes.find((n) => n.id === node.id);
    assert.equal(moved.x, node.x);
    assert.equal(moved.y, node.y);
  }
  assert.throws(() => m.connectChartPeople(next, employees, 'developer', 'ceo'), /team|cycle/);
  assert.throws(() => m.connectChartPeople(org, employees, 'ceo', 'ceo'), /themselves/);
});
test('connector routing changes its bend without changing reporting assignments', () => {
  const { org, employees } = fixture(),
    next = m.routeChartLine(org, employees, 'developer', { x: 650, y: 500 });
  assert.deepEqual(next.assignments, org.assignments);
  assert.deepEqual(next.chartLayout.routes.developer.point, { x: 650, y: 500 });
  assert(!m.routeChartLine(next, employees, 'developer', null).chartLayout.routes.developer);
});
test('undo restores manual positions and reporting lines independently of source mutations', () => {
  const { org, employees } = fixture(),
    placed = m.moveChartPerson(org, employees, 'developer', { x: 700, y: 500 }),
    snapshot = m.chartUndoSnapshot(placed),
    next = m.connectChartPeople(placed, employees, 'ceo', 'developer'),
    restored = m.restoreChartEdit(next, snapshot);
  assert.deepEqual(restored.assignments, placed.assignments);
  assert.deepEqual(restored.chartLayout, placed.chartLayout);
  snapshot.assignments[0].manager = 'invalid';
  assert.notEqual(restored.assignments[0].manager, 'invalid');
});
test('canvas coordinates account for scrolling and zoom', () => {
  assert.deepEqual(
    m.pointerToChart({ x: 200, y: 140 }, { left: 20, top: 30, scrollLeft: 40, scrollTop: 10 }, 2),
    { x: 110, y: 60 },
  );
  assert.throws(
    () => m.pointerToChart({ x: 0, y: 0 }, { left: 0, top: 0, scrollLeft: 0, scrollTop: 0 }, 0),
    /zoom/,
  );
});
test('SVG export escapes user-controlled labels', () => {
  const { org, employees } = fixture();
  employees[0].values[1] = '<script>alert(1)</script>';
  const svg = m.chartSvg(m.chartLayout(org, employees), 'Company <test>');
  assert(!svg.includes('<script>'));
  assert(svg.includes('&lt;script&gt;'));
  assert(svg.includes('Company &lt;test&gt;'));
});

test('manager choices exclude the employee, descendants and people who are not placed', () => {
  const { org, employees } = fixture();
  assert.deepEqual(
    m.eligibleReportingManagers(org, employees, 'manager').map((person) => person.id),
    ['ceo'],
  );
  employees[0].status = 'Exited';
  assert.deepEqual(m.eligibleReportingManagers(org, employees, 'manager'), []);
});

test('a reporting form preserves an unrelated pending drop and applies its own saved placement', () => {
  const { org, employees } = fixture();
  const base = m.arrangementSnapshot(org, employees, m.chartLayout(org, employees));
  const placement = {
    employee: 'new',
    manager: 'manager',
    point: { x: 703, y: 607 },
    base,
    connect: false,
  };
  const untouched = m.prepareReportingChange(
    org,
    employees,
    { employee: 'developer', position: 'position', manager: 'manager' },
    placement,
    false,
  );
  assert.equal(untouched, org);
  const placed = m.prepareReportingChange(
    org,
    employees,
    { employee: 'new', position: 'position', manager: 'manager' },
    placement,
    false,
  );
  assert.equal(placed.assignments.find((row) => row.employee === 'new').manager, 'manager');
  assert.deepEqual(placed.chartLayout.positions.new, { x: 703, y: 607 });
  assert.equal(
    org.assignments.some((row) => row.employee === 'new'),
    false,
  );
});
