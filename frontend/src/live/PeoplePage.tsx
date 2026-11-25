import { useState } from 'react';
import {
  api,
  useApi,
  can,
  download,
  today,
  type Session,
  type Page,
  type Employee,
  type Structure,
} from './api';
import { ActionForm, TextField, field, optional, Loading, Empty } from './shared';
type Document = {
  id: string;
  name: string;
  kind: string;
  size: number;
  verified: boolean;
  expires: string | null;
};
type Contract = {
  id: string;
  reference: string;
  start: string;
  end: string | null;
  status: string;
  concurrencyStamp: string;
};
export function PeoplePage({ session }: { session: Session }) {
  const [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState(false);
  const people = useApi<Page<Employee>>(
    '/employees?maxResultCount=25&skipCount=' + offset + '&search=' + encodeURIComponent(search),
  );
  const structure = useApi<Structure>('/organisation/structure');
  const employee = useApi<Employee>(selected ? '/employees/' + selected : null),
    docs = useApi<Document[]>(
      selected && (can(session, 'People.Write') || selected === session.employeeId)
        ? '/documents?employeeId=' + selected
        : null,
    ),
    contracts = useApi<Contract[]>(
      selected && (can(session, 'People.Write') || selected === session.employeeId)
        ? '/employees/' + selected + '/contracts'
        : null,
    );
  const history = useApi<
    {
      id: string;
      effectiveDate: string;
      description: string;
      beforeStateJson: string;
      afterStateJson: string;
    }[]
  >(
    selected && (can(session, 'People.Write') || selected === session.employeeId)
      ? '/employees/' + selected + '/history'
      : null,
  );
  const write = can(session, 'People.Write');
  function refresh() {
    people.reload();
    employee.reload();
    history.reload();
  }
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">PEOPLE / EMPLOYEE RECORDS</div>
          <h1>
            {write
              ? 'Employees'
              : session.roles.includes('Manager')
                ? 'Team directory'
                : 'My profile'}
          </h1>
          <p>Employment records, contracts and documents in one place.</p>
        </div>
        {write && (
          <button
            className="primary"
            onClick={() => {
              setSelected(null);
              setEditing(true);
            }}
          >
            Add employee
          </button>
        )}
      </div>
      <label className="live-search">
        Find an employee
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Search name, number or email"
        />
      </label>
      <Loading error={people.error} loading={people.loading} />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Number</th>
                <th>Email</th>
                <th>Employment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {people.data?.items.map((person) => (
                <tr key={person.id}>
                  <td>
                    <strong>{person.name}</strong>
                  </td>
                  <td>{person.number}</td>
                  <td>{person.email}</td>
                  <td>{person.exited ? 'Exited ' + person.exited : person.contractType}</td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => {
                        setSelected(person.id);
                        setEditing(false);
                      }}
                    >
                      Open record
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {people.data?.totalCount === 0 && <Empty>No employee records match your search.</Empty>}
        <div className="form-actions">
          <button
            className="secondary"
            disabled={offset === 0}
            onClick={() => setOffset((n) => Math.max(0, n - 25))}
          >
            Previous
          </button>
          <span>{people.data?.totalCount ?? 0} records</span>
          <button
            className="secondary"
            disabled={offset + 25 >= (people.data?.totalCount ?? 0)}
            onClick={() => setOffset((n) => n + 25)}
          >
            Next
          </button>
        </div>
      </section>
      {selected && <Loading error={employee.error} loading={employee.loading} />}{' '}
      {employee.data && selected && (
        <section className="card">
          <div className="page-head">
            <div>
              <h2>{employee.data.name}</h2>
              <p>
                {employee.data.number} · {employee.data.contractType}
              </p>
            </div>
            {write && (
              <button className="secondary" onClick={() => setEditing(!editing)}>
                Edit employee
              </button>
            )}
          </div>
          <dl className="live-details">
            <div>
              <dt>Work email</dt>
              <dd>{employee.data.email || 'Not supplied'}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{employee.data.started}</dd>
            </div>
            <div>
              <dt>Reporting manager</dt>
              <dd>
                {structure.data?.employees.find((p) => p.id === employee.data?.managerId)?.name ??
                  employee.data.managerId ??
                  'Top level'}
              </dd>
            </div>
            <div>
              <dt>Contract type</dt>
              <dd>{employee.data.contractType}</dd>
            </div>
          </dl>
        </section>
      )}
      {editing && write && (!selected || employee.data) && (
        <section className="card">
          <ActionForm
            key={selected ?? 'new'}
            title={selected ? 'Edit employment details' : 'Create employee'}
            onSave={async (data) => {
              const saved = await api<Employee>(
                selected ? '/employees/' + selected : '/employees',
                selected ? 'PUT' : 'POST',
                {
                  number: field(data, 'number'),
                  name: field(data, 'name'),
                  email: field(data, 'email'),
                  started: field(data, 'started'),
                  exited: optional(data, 'exited'),
                  contractType: field(data, 'contractType'),
                  managerId: optional(data, 'managerId'),
                  positionId: optional(data, 'positionId'),
                  concurrencyStamp: employee.data?.concurrencyStamp,
                },
              );
              setSelected(saved.id);
              setEditing(false);
              refresh();
            }}
          >
            <TextField label="Employee number" name="number" value={employee.data?.number} />
            <TextField label="Full name" name="name" value={employee.data?.name} />
            <TextField
              label="Work email"
              name="email"
              type="email"
              required={false}
              value={employee.data?.email}
            />
            <TextField
              label="Start date"
              name="started"
              type="date"
              value={employee.data?.started ?? today()}
            />
            <TextField
              label="Exit date"
              name="exited"
              type="date"
              required={false}
              value={employee.data?.exited ?? ''}
            />
            <TextField
              label="Contract type"
              name="contractType"
              value={employee.data?.contractType ?? 'Permanent'}
            />
            <label>
              Position
              <select name="positionId" defaultValue={employee.data?.positionId ?? ''}>
                <option value="">Not assigned</option>
                {structure.data?.positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reports to
              <select name="managerId" defaultValue={employee.data?.managerId ?? ''}>
                <option value="">Top level</option>
                {structure.data?.employees
                  .filter((p) => p.id !== selected)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          </ActionForm>
        </section>
      )}
      {selected && employee.data && (write || selected === session.employeeId) && (
        <>
          <section className="card">
            <h2>Documents</h2>
            <Loading error={docs.error} loading={docs.loading} />
            {docs.data?.map((doc) => (
              <div className="live-document" key={doc.id}>
                <span>
                  <strong>{doc.name}</strong>
                  <small>
                    {doc.kind} · {Math.ceil(doc.size / 1024)} KB ·{' '}
                    {doc.verified ? 'Verified' : 'Awaiting verification'}
                  </small>
                </span>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      download(await api('/documents/' + doc.id + '/download'));
                    } catch (error) {
                      window.alert(
                        error instanceof Error ? error.message : 'Unable to download document.',
                      );
                    }
                  }}
                >
                  Download
                </button>
                {write && !doc.verified && (
                  <ActionForm
                    submit="Verify"
                    onSave={async (data) => {
                      await api('/documents/' + doc.id + '/verify', 'POST', {
                        purpose: field(data, 'purpose'),
                        attestation: field(data, 'attestation'),
                        signedOn: optional(data, 'signedOn'),
                      });
                      docs.reload();
                    }}
                  >
                    <label>
                      Evidence type
                      <select name="purpose">
                        <option>General</option>
                        <option>UnsignedContract</option>
                        <option>SignedContract</option>
                        <option>Payslip</option>
                      </select>
                    </label>
                    <TextField label="Verification note" name="attestation" />
                    <TextField
                      label="Signature date (signed contracts)"
                      name="signedOn"
                      type="date"
                      required={false}
                    />
                  </ActionForm>
                )}
              </div>
            ))}
            {!docs.data?.length && !docs.loading && <Empty>No accessible documents.</Empty>}
            {(write || selected === session.employeeId) && (
              <ActionForm
                title="Upload employee document"
                submit="Upload"
                onSave={async (data) => {
                  const file = data.get('file');
                  if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
                    throw Error('Choose a PDF, PNG or JPEG up to 5 MB.');
                  const contentBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result).split(',')[1]);
                    reader.onerror = () => reject(Error('Unable to read file.'));
                    reader.readAsDataURL(file);
                  });
                  await api('/documents', 'POST', {
                    employeeId: selected,
                    name: file.name,
                    contentType: file.type,
                    contentBase64,
                    kind: field(data, 'kind'),
                    employeeVisible: data.has('employeeVisible'),
                    expires: optional(data, 'expires'),
                  });
                  docs.reload();
                }}
              >
                <label>
                  File
                  <input
                    name="file"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    required
                  />
                </label>
                <label>
                  Document kind
                  <select name="kind">
                    <option>Employee</option>
                    {write && <option>Contract</option>}
                    {can(session, 'Payroll.Manage') && <option>Payslip</option>}
                    <option value="LeaveEvidence">Leave evidence</option>
                  </select>
                </label>
                <TextField label="Expiry date" name="expires" type="date" required={false} />
                <label className="live-check">
                  <input type="checkbox" name="employeeVisible" defaultChecked />
                  Visible to employee
                </label>
              </ActionForm>
            )}
          </section>
          <section className="card">
            <h2>Employment contracts</h2>
            <Loading error={contracts.error} loading={contracts.loading} />
            {contracts.data?.map((contract) => (
              <div className="live-document" key={contract.id}>
                <div>
                  <strong>{contract.reference}</strong>
                  <p>
                    {contract.start} — {contract.end ?? 'Ongoing'} · {contract.status}
                  </p>
                </div>
                {write && contract.status !== 'Signed' && (
                  <ActionForm
                    submit="Move to next stage"
                    onSave={async (data) => {
                      const states = [
                        'Draft',
                        'InReview',
                        'Approved',
                        'AwaitingSignature',
                        'Signed',
                      ];
                      await api('/contracts/' + contract.id + '/transition', 'POST', {
                        status: states[states.indexOf(contract.status) + 1],
                        note: field(data, 'note'),
                        documentId: optional(data, 'documentId'),
                        concurrencyStamp: contract.concurrencyStamp,
                      });
                      contracts.reload();
                    }}
                  >
                    <TextField label="Review note" name="note" />
                    <label>
                      Evidence document
                      <select name="documentId">
                        <option value="">No additional evidence</option>
                        {docs.data
                          ?.filter((d) => d.kind === 'Contract' && d.verified)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </ActionForm>
                )}
              </div>
            ))}
            {!contracts.data?.length && <Empty>No contracts recorded.</Empty>}
            {write && (
              <ActionForm
                title="Add contract"
                onSave={async (data) => {
                  await api('/contracts', 'POST', {
                    employeeId: selected,
                    reference: field(data, 'reference'),
                    start: field(data, 'start'),
                    end: optional(data, 'end'),
                  });
                  contracts.reload();
                }}
              >
                <TextField label="Contract reference" name="reference" />
                <TextField label="Effective date" name="start" type="date" />
                <TextField label="End date" name="end" type="date" required={false} />
              </ActionForm>
            )}
          </section>
          <section className="card">
            <h2>Employment history</h2>
            <Loading error={history.error} loading={history.loading} />
            {history.data?.map((item) => (
              <div key={item.id} className="live-document">
                <strong>{item.effectiveDate}</strong>
                <p>{item.description}</p>
              </div>
            ))}
            {!history.data?.length && <Empty>No employment changes recorded.</Empty>}
          </section>
        </>
      )}
    </>
  );
}
