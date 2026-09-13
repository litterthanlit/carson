# Carson Lab

A local, browser-based poster editor (Vite + React 19 + TypeScript) for David Carson-inspired compositions. An optional native macOS shell (`Package.swift`, `macos/`, `script/build_and_run.sh`) bundles the built web app but is **macOS-only**.

Standard commands live in `README.md` and `package.json` scripts: `npm run dev`, `npm test`, `npm run build`, `npm run lint`.

## Cursor Cloud specific instructions

- The primary, testable product on this Linux VM is the **web app**. Run it with `npm run dev` (Vite serves at `http://localhost:5173/`). Build/tests/lint all run in the Node toolchain.
- The **macOS native wrapper cannot be built or run on the Linux cloud VM**: there is no Swift toolchain, and `script/build_and_run.sh` relies on macOS-only tools (`swift build`, `open`, `lldb`, `log`, AppKit). Treat `Package.swift`, `macos/`, and `script/build_and_run.sh` as out of scope here.
- `npm run lint` currently exits non-zero due to a **pre-existing** lint error in `src/lib/storage.ts` (`no-useless-assignment`) plus one `react-hooks/exhaustive-deps` warning in `src/hooks/usePathEditing.ts`. These are not caused by environment setup; don't treat a failing `lint` exit code as a broken environment.
- The editor opens with a "Wreck this poster" onboarding modal and a demo poster preloaded; dismiss the modal (e.g. "Skip intro") to reach the canvas. Core actions (add/edit text, typography controls, add shapes, layers panel) work fully client-side with no backend or env vars.
