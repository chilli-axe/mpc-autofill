import Link from "next/link";

function Spacer() {
  return (
    <span style={{ marginLeft: 0.25 + "em", marginRight: 0.25 + "em" }}> </span>
  );
}

export default function Footer() {
  return (
    <>
      <hr />
      <footer className="page-footer font-small blue">
        <div className="footer-copyright text-center py-3">
          <a href="https://github.com/chilli-axe/mpc-autofill" target="_blank">
            GitHub
          </a>
          <Spacer />•<Spacer />
          <a href={process.env.REDDIT} target="_blank">
            Reddit
          </a>
          <Spacer />•<Spacer />
          <a href={process.env.DISCORD} target="_blank">
            Discord
          </a>
          <Spacer />•<Spacer />
          <Link href="/about">About</Link>
        </div>
      </footer>
    </>
  );
}
