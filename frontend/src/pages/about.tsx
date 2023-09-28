import Head from "next/head";
import styled from "styled-components";

import { useGetBackendInfoQuery } from "@/app/api";
import { ProjectName } from "@/common/constants";
import { MakePlayingCards, MakePlayingCardsURL } from "@/common/constants";
import { useProjectName } from "@/features/backend/backendSlice";
import Footer from "@/features/ui/footer";
import { ProjectContainer } from "@/features/ui/layout";

const CentreAligned = styled.div`
  text-align: center;
`;

function BackendDescription() {
  const backendInfoQuery = useGetBackendInfoQuery();

  return (
    <>
      {backendInfoQuery.isSuccess &&
        backendInfoQuery.data?.name != null &&
        (backendInfoQuery.data?.description ?? "").length > 0 && (
          <>
            <h2>About {backendInfoQuery.data.name}</h2>
            <p
              dangerouslySetInnerHTML={{
                __html: backendInfoQuery.data.description ?? "",
              }}
            />
          </>
        )}
    </>
  );
}

export default function About() {
  const projectName = useProjectName();
  return (
    <ProjectContainer>
      <Head>
        <title>About {projectName}</title>
        <meta name="description" content={`About ${projectName}`} />
      </Head>
      <h2>About {ProjectName}</h2>
      <p>
        {ProjectName} is an open source project licensed under the{" "}
        <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">
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
      <CentreAligned>
        <a
          href="https://github.com/chilli-axe/mpc-autofill/graphs/contributors"
          target="_blank"
        >
          <img src="https://contrib.rocks/image?repo=chilli-axe/mpc-autofill&columns=5" />
        </a>
      </CentreAligned>
      <BackendDescription />
      <h2>Disclaimer</h2>
      <p>
        Custom card images displayed on {ProjectName} are subject to the license
        terms under which they were uploaded to their hosts. MPC Autofill is not
        responsible for the content of user-uploaded images.
      </p>
      <p>
        {ProjectName} does not condone or support the resale (or other
        commercial use) of cards printed with this website in any way. As per{" "}
        <a href={MakePlayingCardsURL} target="_blank">
          {MakePlayingCards}
        </a>
        &apos;s user agreement, users acknowledge that they{" "}
        <i>
          &quot;...own all copyrights for [card images used in orders] or have
          full authorization to use them.&quot;
        </i>
      </p>
      <p>
        {ProjectName} is not affiliated with, produced by, or endorsed by{" "}
        <a href={MakePlayingCardsURL} target="_blank">
          {MakePlayingCards}
        </a>{" "}
        or any other commercial entities.
      </p>
      <h2>Privacy Policy</h2>
      <b>Last updated: 11th April, 2023</b>
      <p>
        {ProjectName} collects site usage data through Google Analytics via
        cookies. Understanding how users interact with the site allows me to
        continue to improve the site to the best of my ability. Users are
        presented with the option to opt-out of having their data collected by
        Google Analytics.
      </p>
      <p>
        We use local storage to remember your search settings and your server
        configuration, which is considered core site functionality and cannot be
        disabled.
      </p>
      <p>
        {ProjectName} will never share information collected by Google Analytics
        with third parties.
      </p>
      <p>
        Information collected by Google Analytics includes the following items.{" "}
        <b>Note</b>: this is not an exhaustive list, but captures the motivation
        for implementing Google Analytics:
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
          Average site usage across times of day and days of the week, allowing
          me to schedule site maintenance more effectively.
        </li>
      </ul>
      <p>
        {ProjectName}&apos;s usage of Google Analytics does not include the
        usage of Google Adwords or other advertising features.
      </p>
      <p>
        You can find more information on Google&apos;s privacy policy{" "}
        <a href="https://policies.google.com/privacy?hl=en-US" target="_blank">
          here
        </a>
        . Google also provides a browser extension to disable Google Analytics,
        which you can find{" "}
        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank">
          here
        </a>
        .
      </p>
      <Footer />
    </ProjectContainer>
  );
}
