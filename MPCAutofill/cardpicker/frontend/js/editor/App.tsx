import * as React from "react";
import { CardGrid } from "./cardGrid";
import { SearchSettings } from "./searchSettings";

function App() {
  return (
    <div>
      <div className="col-lg-8 col-md-8 col-sm-6 col-6">
        <CardGrid />
      </div>
      <div className="col-lg-4 col-md-4 col-sm-6 col-6" style={{ zIndex: 1 }}>
        <div className="sticky-top sticky-offset g-0">
          <h2>Edit MPC Project</h2>
          <div className="col-lg-6 col-md-12 col-sm-12 col-12">
            <SearchSettings />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
