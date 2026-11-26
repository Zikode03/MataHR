# MataHR

Matateni Technologies HR platform. The React/TypeScript frontend is in `frontend/`; the ABP backend is maintained in `Zikode03/MataHR-Backend`.

The default frontend now uses the live Daily Workspace API for authentication, employees, organisation, digital attendance, leave, payroll inputs and four role workspaces. It does not fall back to fictional records when the API is unavailable.

Start the backend on `https://localhost:7043`, then run these commands from the repository root:

```powershell
npm install
npm run dev
```

The root commands install and run the app in `frontend/`. Open `http://localhost:5173`. You can also run `npm ci` and `npm start` directly in `frontend/`. See [frontend setup and verification](frontend/README.md).

Other HR module prototypes and the Angular snapshot remain as design/source references. They are not presented as completed live modules. Production deployment, external payroll-provider processing and operational controls remain separate work.
