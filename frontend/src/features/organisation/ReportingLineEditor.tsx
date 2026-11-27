import { Network } from 'lucide-react';
import { Link } from 'react-router-dom';

import { chartUndoSnapshot, createChartPosition, removePerson } from './model';

import type { OrganisationChartContext } from './useOrganisationChart';
export function ReportingLineEditor({
  context,
}: {
  context: Pick<
    OrganisationChartContext,
    | 'org'
    | 'setOrg'
    | 'employees'
    | 'onManage'
    | 'setQuery'
    | 'setDepartment'
    | 'setBranch'
    | 'setFocus'
    | 'setSelected'
    | 'editing'
    | 'setEditing'
    | 'addingUnder'
    | 'form'
    | 'setForm'
    | 'creatingPosition'
    | 'setCreatingPosition'
    | 'removing'
    | 'setRemoving'
    | 'replacement'
    | 'setReplacement'
    | 'setMessage'
    | 'error'
    | 'setError'
    | 'setUndoStack'
    | 'setPendingDrop'
    | 'editor'
    | 'people'
    | 'activeAssignment'
    | 'managers'
    | 'addReport'
    | 'save'
  >;
}) {
  const {
    org,
    setOrg,
    employees,
    onManage,
    setQuery,
    setDepartment,
    setBranch,
    setFocus,
    setSelected,
    editing,
    setEditing,
    addingUnder,
    form,
    setForm,
    creatingPosition,
    setCreatingPosition,
    removing,
    setRemoving,
    replacement,
    setReplacement,
    setMessage,
    error,
    setError,
    setUndoStack,
    setPendingDrop,
    editor,
    people,
    activeAssignment,
    managers,
    addReport,
    save,
  } = context;
  return (
    <>
      {' '}
      {editing ? (
        <section className="card org-report-editor" ref={editor}>
          <div className="section-head">
            <h3>
              {form.employee && activeAssignment
                ? 'Edit reporting line'
                : form.manager
                  ? 'Add a direct report'
                  : 'Place an employee'}
            </h3>
            <button
              className="ops-close"
              aria-label="Close reporting line editor"
              onClick={() => {
                setEditing(false);
                setPendingDrop(null);
                setRemoving(false);
                setError('');
              }}
            >
              ×
            </button>
          </div>
          <p className="admin-caption">
            Choose a job position and a reporting manager. The chart updates when you save.
          </p>
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label>
              Employee
              <select
                required
                value={form.employee}
                onChange={(e) => {
                  const employee = e.target.value,
                    assignment = org.assignments.find((a) => a.employee === employee);
                  setForm((f) => ({
                    ...f,
                    employee,
                    position: assignment?.position ?? '',
                    manager: addingUnder !== null ? f.manager : (assignment?.manager ?? ''),
                  }));
                  setPendingDrop(null);
                  setRemoving(false);
                  setError('');
                }}
              >
                <option value="">Choose employee</option>
                {people.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.values[1]} · {e.values[0]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Position / department
              <select
                required
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              >
                <option value="">Choose a position</option>
                {org.positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {org.departments.find((d) => d.id === p.department)?.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="ops-text-button org-inline-position"
              onClick={() => setCreatingPosition(!creatingPosition)}
            >
              {creatingPosition ? 'Close position form' : '+ Create a new position'}
            </button>
            <label>
              Reports to
              <select
                value={form.manager}
                onChange={(e) => setForm({ ...form, manager: e.target.value })}
              >
                <option value="">No manager · top level</option>
                {form.manager && !managers.some((e) => e.id === form.manager) && (
                  <option value={form.manager} disabled>
                    Manager unavailable · choose another
                  </option>
                )}
                {managers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.values[1]} ·{' '}
                    {
                      org.positions.find(
                        (p) => p.id === org.assignments.find((a) => a.employee === e.id)?.position,
                      )?.name
                    }
                  </option>
                ))}
              </select>
            </label>
            <p className="admin-caption">
              Managers must be placed first. Employees cannot report to themselves or anyone in
              their own team.
            </p>
            <button className="primary">Save reporting line</button>
          </form>
          {creatingPosition && (
            <form
              className="org-quick-position"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const result = createChartPosition(
                    org,
                    String(f.get('name')),
                    String(f.get('department')),
                  );
                  setUndoStack([]);
                  setOrg(result.org);
                  setForm((previous) => ({ ...previous, position: result.position.id }));
                  setCreatingPosition(false);
                  setMessage('Position created. Save the reporting line to assign the employee.');
                  setError('');
                } catch (problem) {
                  setError(
                    problem instanceof Error ? problem.message : 'Unable to create position.',
                  );
                }
              }}
            >
              <h3>Create a position</h3>
              <label>
                Job title
                <input name="name" required />
              </label>
              <label>
                Department
                <select name="department" required>
                  <option value="">Choose department</option>
                  {org.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary">Create position</button>
              <button
                type="button"
                className="ops-text-button"
                onClick={() => onManage('departments')}
              >
                Need a department? Manage departments →
              </button>
            </form>
          )}
          {activeAssignment && (
            <div className="org-chart-edit-actions">
              <Link to={'/employees?employee=' + form.employee + '&tab=Employment'}>
                Open employee record →
              </Link>
              <button
                className="ops-text-button"
                onClick={() => {
                  setFocus(form.employee);
                  setQuery('');
                  setDepartment('');
                  setBranch('');
                }}
              >
                Focus on this team
              </button>
              <button
                className="ops-text-button"
                onClick={() => {
                  setRemoving(!removing);
                  setReplacement(
                    managers.some((e) => e.id === activeAssignment.manager)
                      ? activeAssignment.manager
                      : '',
                  );
                }}
              >
                Remove from chart
              </button>
            </div>
          )}
          {removing && activeAssignment && (
            <div className="org-chart-removal">
              <p>
                The employee stays in the directory. Their direct reports will move to the manager
                selected below.
              </p>
              <label>
                Move direct reports to
                <select value={replacement} onChange={(e) => setReplacement(e.target.value)}>
                  <option value="">Top level</option>
                  {managers.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.values[1]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary"
                onClick={() => {
                  try {
                    setUndoStack((previous) => [...previous.slice(-19), chartUndoSnapshot(org)]);
                    setOrg(removePerson(org, employees, form.employee, replacement));
                    setMessage(
                      'Employee removed from the chart. Their personnel record is retained and direct reports have been reassigned.',
                    );
                    setEditing(false);
                    setRemoving(false);
                    setSelected('');
                    setError('');
                  } catch (problem) {
                    setError(
                      problem instanceof Error
                        ? problem.message
                        : 'Unable to remove reporting line.',
                    );
                  }
                }}
              >
                Confirm removal from chart
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="card org-chart-help">
          <span className="org-chart-help-icon">
            <Network size={25} />
          </span>
          <h3>HR builds the structure</h3>
          <ol>
            <li>
              Drag a person from <strong>Needs placement</strong> onto the canvas.
            </li>
            <li>
              In <strong>Arrange cards</strong>, drag cards wherever you want.
            </li>
            <li>
              Switch to <strong>Change manager</strong> and drop a card onto its new manager.
            </li>
            <li>
              Use <strong>Undo</strong> to reverse a change, or Auto-arrange to tidy the layout.
            </li>
          </ol>
          <p>
            Connectors follow your cards. Moving a card in Arrange mode keeps its reporting line
            unchanged.
          </p>
          <button className="secondary" onClick={() => addReport()}>
            Add reporting line
          </button>
          <Link to="/employees">Need a new employee? Open directory →</Link>
        </section>
      )}
    </>
  );
}
