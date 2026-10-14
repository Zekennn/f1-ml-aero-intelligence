/**
 * Re-mounts on every navigation: a curtain with a red leading edge lifts off the new
 * page while its content fades in (opacity only, so fixed/sticky children are unaffected).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pt-curtain" aria-hidden="true" />
      <div className="pt-content">{children}</div>
    </>
  );
}
