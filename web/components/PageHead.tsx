/** Dark-blue title band at the top of the data pages. */
export default function PageHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="page-head">
      <div className="container">
        <p className="eyebrow eyebrow--light">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  );
}
