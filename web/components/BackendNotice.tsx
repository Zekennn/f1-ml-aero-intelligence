/** Shown when the FastAPI backend can't be reached. */
export default function BackendNotice({ extra }: { extra?: string }) {
  return (
    <div className="notice" role="alert">
      Can&apos;t reach the data backend. Start it from the project root with{" "}
      <code>cd backend; uvicorn main:app --port 8000</code>, then refresh this page.
      {extra && <> {extra}</>}
    </div>
  );
}
