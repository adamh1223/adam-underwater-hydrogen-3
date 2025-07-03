import Sectiontitle from '~/components/global/Sectiontitle';
import '../styles/routeStyles/work.css';

function WorkPage() {
  return (
    <>
      <div className="flex justify-center pb-5 ps-5">
        <img src={'/work2.png'} style={{height: '115px'}} className="pt-3" />
      </div>
      <div>
        <Sectiontitle text="Seaforestation (Trailer)" />
      </div>
      <div className="clip-wrapper flex justify-center position-relative">
        <iframe
          className="clip"
          src="https://player.vimeo.com/video/814128392?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
          allow="autoplay; fullscreen; picture-in-picture;"
          title="Seaforestation Trailer"
        ></iframe>
      </div>

      {/* <script src="https://player.vimeo.com/api/player.js"></script> */}
      <div>
        <Sectiontitle text="Urchinomics x Sumiré Uni Co" />
      </div>
      <div className="clip-wrapper flex justify-center position-relative p-[50px]">
        <iframe
          className="clip"
          src="https://player.vimeo.com/video/795362432?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
          allow="autoplay; fullscreen; picture-in-picture;"
          title="Urchinomics"
        ></iframe>
      </div>
      <script src="https://player.vimeo.com/api/player.js"></script>
    </>
  );
}

export default WorkPage;
