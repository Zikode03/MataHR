import { useEffect, useState } from 'react';
import {
  api,
  useApi,
  can,
  message,
  periodQuery,
  today,
  type Session,
  type Page,
  type Employee,
  type Location,
  type WorkSession,
} from './api';
import { ActionForm, field, number, optional, TextField, Loading, Empty } from './shared';
type Request = {
  id: string;
  employeeId: string;
  kind: string;
  date: string;
  start: string;
  end: string;
  reason: string;
  status: string;
  concurrencyStamp: string;
};
type Schedule = {
  employeeId: string;
  daysMask: number;
  start: string;
  end: string;
  graceMinutes: number;
};
export function AttendancePage({ session }: { session: Session }) {
  const [range, setRange] = useState({ from: today().slice(0, 7) + '-01', to: today() }),
    [location, setLocation] = useState(''),
    [code, setCode] = useState(''),
    [exception, setException] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(''),
    [siteCode, setSiteCode] = useState<{ code: string; expiresAt: string } | null>(null),
    [displaySite, setDisplaySite] = useState(''),
    [now, setNow] = useState(Date.now());
  const [autoRotate, setAutoRotate] = useState(false);
  const query = 'from=' + range.from + '&to=' + range.to;
  const records = useApi<Page<WorkSession>>('/attendance?' + query + '&maxResultCount=200'),
    locations = useApi<Location[]>('/attendance/locations'),
    requests = useApi<Request[]>('/attendance/requests?' + query),
    people = useApi<Page<Employee>>(
      can(session, 'Attendance.Review') ? '/employees?maxResultCount=200' : null,
    ),
    schedules = useApi<Schedule[]>(
      can(session, 'Attendance.Configure') ? '/attendance/schedules' : null,
    );
  const current = useApi<WorkSession>(session.employeeId ? '/attendance/current' : null);
  const own = current.data;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!autoRotate || !displaySite) return;
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function rotate() {
      try {
        const generated = await api<{ code: string; expiresAt: string }>(
          '/attendance/locations/' + displaySite + '/code',
          'POST',
          {},
          controller.signal,
        );
        if (stopped) return;
        setSiteCode(generated);
        timer = setTimeout(
          rotate,
          Math.max(1000, Date.parse(generated.expiresAt) - Date.now() - 500),
        );
      } catch (error) {
        if (!stopped) {
          setFeedback(message(error));
          setAutoRotate(false);
        }
      }
    }
    void rotate();
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [autoRotate, displaySite]);
  function reload() {
    records.reload();
    requests.reload();
    current.reload();
  }
  async function clock() {
    setBusy(true);
    setFeedback('');
    try {
      if (own) await api('/attendance/clock-out', 'POST');
      else {
        const site = locations.data?.find((s) => s.id === location);
        if (!site) throw Error('Choose a work location.');
        let proof: Record<string, unknown> = {};
        if (exception) {
          if (!reason.trim()) throw Error('Explain why this attendance needs an exception.');
          proof = { exceptionReason: reason.trim() };
        } else if (!['Remote', 'Business travel'].includes(site.kind)) {
          if (!code.trim()) throw Error('Enter the current code displayed at your worksite.');
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(Error('This browser does not support location. Submit an exception instead.'));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              resolve,
              () =>
                reject(
                  Error(
                    'Location was unavailable. Allow location access or submit an exception for review.',
                  ),
                ),
              { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
            );
          });
          proof = {
            siteCode: code.trim(),
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            observedAt: new Date(position.timestamp).toISOString(),
          };
        }
        await api('/attendance/clock-in', 'POST', { locationId: location, ...proof });
      }
      setFeedback(
        own
          ? 'Clocked out. Your completed attendance is awaiting review.'
          : 'Clocked in successfully.',
      );
      setCode('');
      reload();
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }
  const name = (id: string) =>
    people.data?.items.find((p) => p.id === id)?.name ?? (id === session.employeeId ? 'You' : id);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">DAILY WORKSPACE / DIGITAL REGISTER</div>
          <h1>Digital register</h1>
          <p>Record your working day and review attendance exceptions.</p>
        </div>
      </div>
      <section className="card live-clock">
        <span className="eyebrow">{today()}</span>
        <h2>{own ? 'You’re clocked in' : 'Start your working day'}</h2>
        <strong className="live-clock-time">
          {own
            ? new Date(Math.max(0, now - Date.parse(own.start))).toISOString().slice(11, 19)
            : new Intl.DateTimeFormat('en-ZA', {
                timeZone: 'Africa/Johannesburg',
                timeStyle: 'short',
              }).format(now)}
        </strong>
        {own ? (
          <>
            <p>
              Started {new Date(own.start).toLocaleTimeString()} · {own.evidence}
            </p>
            {own.exceptionReason && <p>{own.exceptionReason}</p>}
          </>
        ) : (
          <div className="live-clock-fields">
            <label>
              Work location
              <select
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setCode('');
                }}
              >
                <option value="">Choose location</option>
                {locations.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.kind}
                  </option>
                ))}
              </select>
            </label>
            <label className="live-check">
              <input
                type="checkbox"
                checked={exception}
                onChange={(e) => setException(e.target.checked)}
              />
              Request an attendance exception
            </label>
            {exception ? (
              <label>
                Reason for review
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain remote work, location access problems or another exception."
                />
              </label>
            ) : location &&
              !['Remote', 'Business travel'].includes(
                locations.data?.find((s) => s.id === location)?.kind ?? '',
              ) ? (
              <>
                <label>
                  Current on-site code
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={8}
                  />
                </label>
                <small>
                  This checks your location at clock-in; it does not prove continuous presence. Your
                  device location must be accurate to 50 metres and fully inside HR’s configured
                  workplace boundary.
                </small>
              </>
            ) : (
              <p>Remote attendance is unverified until independently reviewed.</p>
            )}
          </div>
        )}
        <button
          className="primary"
          disabled={busy || current.loading || !session.employeeId || (!own && !location)}
          onClick={clock}
        >
          {busy ? 'Recording…' : own ? 'Clock out' : 'Clock in'}
        </button>
        {!session.employeeId && (
          <p>Ask an administrator to link your account to an employee record.</p>
        )}
        {feedback && <p role="status">{feedback}</p>}
        <Loading
          error={locations.error || current.error}
          loading={locations.loading || current.loading}
        />
      </section>
      <section className="card">
        <div className="page-head">
          <h2>Attendance records</h2>
          <div className="live-date-filter">
            <label>
              From
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
              />
            </label>
          </div>
        </div>
        <Loading error={records.error} loading={records.loading} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Clock in / out</th>
                <th>Presence evidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.data?.items.map((row) => (
                <tr key={row.id}>
                  <td>{name(row.employeeId)}</td>
                  <td>{row.date}</td>
                  <td>
                    {new Date(row.start).toLocaleTimeString()} —{' '}
                    {row.end ? new Date(row.end).toLocaleTimeString() : 'Open'}
                  </td>
                  <td>
                    {row.evidence}
                    <small>{row.exceptionReason}</small>
                  </td>
                  <td>
                    {row.status}
                    {can(session, 'Attendance.Review') &&
                      row.status === 'Pending review' &&
                      row.employeeId !== session.employeeId && (
                        <ActionForm
                          submit="Record decision"
                          onSave={async (data) => {
                            await api('/attendance/' + row.id + '/review', 'POST', {
                              status: field(data, 'status'),
                              note: field(data, 'note'),
                              concurrencyStamp: row.concurrencyStamp,
                            });
                            reload();
                          }}
                        >
                          <label>
                            Decision
                            <select name="status">
                              <option>Approved</option>
                              <option>Rejected</option>
                            </select>
                          </label>
                          <TextField name="note" label="Review reason" />
                        </ActionForm>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.data?.totalCount === 0 && <Empty>No attendance in this date range.</Empty>}
        {(records.data?.totalCount ?? 0) > 200 && (
          <p>Showing the first 200 records. Narrow the date range.</p>
        )}
      </section>
      <section className="card">
        <h2>Corrections & overtime</h2>
        <Loading error={requests.error} loading={requests.loading} />
        {requests.data?.map((row) => (
          <div className="live-document" key={row.id}>
            <div>
              <strong>
                {name(row.employeeId)} · {row.kind}
              </strong>
              <p>
                {row.date} · {row.reason} · {row.status}
              </p>
            </div>
            {can(session, 'Attendance.Review') &&
              row.status === 'Pending' &&
              row.employeeId !== session.employeeId && (
                <ActionForm
                  submit="Record decision"
                  onSave={async (data) => {
                    await api('/attendance/requests/' + row.id + '/review', 'POST', {
                      status: field(data, 'status'),
                      note: field(data, 'note'),
                      concurrencyStamp: row.concurrencyStamp,
                    });
                    reload();
                  }}
                >
                  <label>
                    Decision
                    <select name="status">
                      <option>Approved</option>
                      <option>Rejected</option>
                    </select>
                  </label>
                  <TextField label="Review reason" name="note" />
                </ActionForm>
              )}
          </div>
        ))}
        {session.employeeId && (
          <ActionForm
            title="Request a correction or overtime"
            submit="Submit request"
            onSave={async (data) => {
              await api('/attendance/requests', 'POST', {
                kind: field(data, 'kind'),
                sessionId: field(data, 'sessionId'),
                date: field(data, 'date'),
                start: new Date(field(data, 'start')).toISOString(),
                end: new Date(field(data, 'end')).toISOString(),
                reason: field(data, 'reason'),
              });
              reload();
            }}
          >
            <label>
              Request
              <select name="kind">
                <option>Correction</option>
                <option>Overtime</option>
              </select>
            </label>
            <label>
              Work session
              <select name="sessionId" required>
                <option value="">Choose your session</option>
                {records.data?.items
                  .filter((r) => r.employeeId === session.employeeId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.date} · {r.status}
                    </option>
                  ))}
              </select>
            </label>
            <TextField name="date" label="Work date" type="date" />
            <TextField name="start" label="Correct start / overtime start" type="datetime-local" />
            <TextField name="end" label="Correct end / overtime end" type="datetime-local" />
            <TextField name="reason" label="Reason" />
          </ActionForm>
        )}
      </section>
      {can(session, 'Attendance.Configure') && (
        <>
          <section className="card">
            <h2>Work locations & verification</h2>
            <ActionForm
              title="Add a location"
              onSave={async (data) => {
                await api('/attendance/locations', 'POST', {
                  name: field(data, 'name'),
                  kind: field(data, 'kind'),
                });
                locations.reload();
              }}
            >
              <TextField name="name" label="Location name" />
              <label>
                Type
                <select name="kind">
                  <option>Office</option>
                  <option>Remote</option>
                  <option>Client site</option>
                  <option>Business travel</option>
                  <option>Training venue</option>
                </select>
              </label>
            </ActionForm>
            {locations.data
              ?.filter((s) => !['Remote', 'Business travel'].includes(s.kind))
              .map((site) => (
                <ActionForm
                  key={site.id}
                  title={site.name + ' · GPS boundary'}
                  onSave={async (data) => {
                    await api('/attendance/locations/' + site.id + '/boundary', 'PUT', {
                      latitude: number(data, 'latitude'),
                      longitude: number(data, 'longitude'),
                      radiusMeters: number(data, 'radius'),
                    });
                    locations.reload();
                  }}
                >
                  <label>
                    Latitude
                    <input
                      name="latitude"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      defaultValue={site.latitude ?? ''}
                      required
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      name="longitude"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      defaultValue={site.longitude ?? ''}
                      required
                    />
                  </label>
                  <label>
                    Radius (metres)
                    <input
                      name="radius"
                      type="number"
                      min="50"
                      max="1000"
                      defaultValue={site.radiusMeters >= 50 ? site.radiusMeters : 150}
                      required
                    />
                  </label>
                  <p>
                    Enter the actual workplace coordinates. An unconfigured site cannot verify
                    on-site clock-ins.
                  </p>
                </ActionForm>
              ))}
          </section>
          <section className="card live-site-display">
            <h2>On-site code display</h2>
            <p>
              Display this only at the workplace. Employees still need a fresh GPS check within the
              boundary. The display rotates the code automatically every two minutes while open.
            </p>
            <label>
              Site
              <select
                value={displaySite}
                onChange={(e) => {
                  setDisplaySite(e.target.value);
                  setSiteCode(null);
                  setAutoRotate(false);
                }}
              >
                <option value="">Choose configured site</option>
                {locations.data
                  ?.filter((s) => s.latitude !== null)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={!displaySite || busy}
              onClick={() => {
                setFeedback('');
                setAutoRotate((value) => !value);
              }}
            >
              {autoRotate ? 'Stop rotating display' : 'Generate / rotate code'}
            </button>
            {siteCode && (
              <>
                <output className="live-site-code">
                  {Date.parse(siteCode.expiresAt) > now ? siteCode.code : 'Expired'}
                </output>
                <p>
                  {Math.max(0, Math.ceil((Date.parse(siteCode.expiresAt) - now) / 1000))} seconds
                  remaining
                </p>
              </>
            )}
          </section>
          <section className="card">
            <h2>Working schedules</h2>
            <Loading loading={schedules.loading} error={schedules.error} />
            {schedules.data?.map((s) => (
              <p key={s.employeeId}>
                {name(s.employeeId)} · {s.start}–{s.end} · {s.graceMinutes} minutes grace
              </p>
            ))}
            <ActionForm
              title="Set an employee schedule"
              onSave={async (data) => {
                await api('/attendance/schedules', 'PUT', {
                  employeeId: field(data, 'employeeId'),
                  daysMask: number(data, 'daysMask'),
                  start: field(data, 'start') + ':00',
                  end: field(data, 'end') + ':00',
                  graceMinutes: number(data, 'graceMinutes'),
                });
                schedules.reload();
              }}
            >
              <label>
                Employee
                <select required name="employeeId">
                  <option value="">Choose…</option>
                  {people.data?.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Working days
                <select name="daysMask">
                  <option value="62">Monday–Friday</option>
                  <option value="126">Monday–Saturday</option>
                  <option value="127">Every day</option>
                </select>
              </label>
              <TextField name="start" label="Start" type="time" value="08:00" />
              <TextField name="end" label="End" type="time" value="17:00" />
              <TextField name="graceMinutes" label="Grace minutes" type="number" value={15} />
            </ActionForm>
          </section>
        </>
      )}
    </>
  );
}
