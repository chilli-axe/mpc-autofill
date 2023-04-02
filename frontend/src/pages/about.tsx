import Head from "next/head";
import Layout from "@/features/ui/layout";
import Footer from "@/features/ui/footer";

export default function About() {
  return (
    <>
      <Head>
        <title>About MPC Autofill</title>
        <meta name="description" content="About MPC Autofill" />
      </Head>
      <Layout>
        <h2>About</h2>
        <p>
          MPC Autofill is an open source project licensed under the{" "}
          <a href="https://www.gnu.org/licenses/gpl-3.0.en.html">
            GNU General Public License 3
          </a>{" "}
          &mdash; meaning it is free to use, modify, and distribute. Read the
          license (linked) for more detail.
        </p>
        <p>
          This project is only possible because of the code contributions of the
          following people (thanks to{" "}
          <a href="https://contrib.rocks" target="_blank">
            contrib.rocks
          </a>{" "}
          for the graphic!):
        </p>
        <div style={{ textAlign: "center" }}>
          <a
            href="https://github.com/chilli-axe/mpc-autofill/graphs/contributors"
            target="_blank"
          >
            <img src="https://contrib.rocks/image?repo=chilli-axe/mpc-autofill&columns=5" />
          </a>
        </div>
        <h2>Disclaimer</h2>
        <p>
          Custom card images displayed on MPC Autofill are subject to the
          license terms under which they were uploaded to their hosts. MPC
          Autofill is not responsible for the content of user-uploaded images.
        </p>
        <p>
          MPC Autofill does not condone or support the resale (or other
          commercial use) of cards printed with this website in any way. As per{" "}
          <a href="https://www.makeplayingcards.com/" target="_blank">
            MakePlayingCards.com
          </a>
          &apos;s user agreement, users acknowledge that they{" "}
          <i>
            &quot;...own all copyrights for [card images used in orders] or have
            full authorization to use them.&quot;
          </i>
        </p>
        <p>
          MPC Autofill is not affiliated with, produced by, or endorsed by{" "}
          <a href="https://www.makeplayingcards.com/" target="_blank">
            MakePlayingCards.com
          </a>{" "}
          or any other commercial entities.
        </p>
        <h2>Privacy Policy</h2>
        <b>Last updated: 26th March, 2023</b>
        <p>
          MPC Autofill collects site usage data through Google Analytics via
          cookies. Understanding how users interact with the site allows me to
          continue to improve the site to the best of my ability. Users are
          presented with the option to opt-out of having their data collected by
          Google Analytics.
        </p>
        <p>
          We use cookies to remember your search settings, which is considered
          core site functionality and cannot be disabled.
        </p>
        <p>
          MPC Autofill will never share information collected by Google
          Analytics with third parties.
        </p>
        <p>
          Information collected by Google Analytics includes the following
          items. <b>Note</b>: this is not an exhaustive list, but captures the
          motivation for implementing Google Analytics:
        </p>
        <ul>
          <li>
            Data on how many users interact with the site (real-time and
            historical),
          </li>
          <li>
            Statistics on how users interact with the site &mdash; session
            duration, bounce rate, page views, pages per session, sessions per
            user,
          </li>
          <li>
            How users discover the site &mdash; organic search (including search
            keywords), direct by URL, referral, etc.,
          </li>
          <li>
            Audience demographics &mdash; the countries and cities my users hail
            from, and the languages they speak,
          </li>
          <li>
            The platforms/technology through which users interact with the site,
          </li>
          <li>
            Average site usage across times of day and days of the week,
            allowing me to schedule site maintenance more effectively.
          </li>
        </ul>
        <p>
          MPC Autofill&apos;s usage of Google Analytics does not include the
          usage of Google Adwords or other advertising features.
        </p>
        <p>
          You can find more information on Google&apos;s privacy policy{" "}
          <a
            href="https://policies.google.com/privacy?hl=en-US"
            target="_blank"
          >
            here
          </a>
          . Google also provides a browser extension to disable Google
          Analytics, which you can find{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank">
            here
          </a>
          .
        </p>
      </Layout>
      <Footer />
    </>
  );
}
