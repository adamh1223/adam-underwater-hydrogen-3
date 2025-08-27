import React from 'react';
import {Button} from '~/components/ui/button';
import '../styles/routeStyles/downloads.css';

function downloads() {
  return (
    <>
      <section>
        <div className="subheader">
          This is where your purchased stock footage downloads links and stock
          footage licensing forms will reside.
        </div>
        <Button variant="default">Download</Button>
      </section>
    </>
  );
}

export default downloads;
