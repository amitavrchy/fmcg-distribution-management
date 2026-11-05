import Link from "next/link";
export default function NotFound() {
  return (
    <main className="boot">
      <div className="brand-symbol">d</div>
      <h1>This page took a different route.</h1>
      <p>Let’s get you back to your distribution workspace.</p>
      <Link className="button primary" href="/">
        Back to overview
      </Link>
    </main>
  );
}
