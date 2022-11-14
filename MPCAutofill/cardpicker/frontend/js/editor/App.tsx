import * as React from "react";
import { CardGrid } from "./cardGrid";
import { SearchSettings } from "./searchSettings";

// import './App.css';

function App() {
  return (
    <div>
      <h1>Hello world from React!</h1>
      <div className="row">
        <div className="col-lg-8 col-md-8 col-sm-6 col-6">
          <CardGrid></CardGrid>
        </div>
        <div className="col-lg-4 col-md-4 col-sm-6 col-6">
          <div className="sticky-top sticky-offset g-0">
            <div className="row g-0">
              <div className="col-lg-6 col-md-12 col-sm-12 col-12">
                <SearchSettings></SearchSettings>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
