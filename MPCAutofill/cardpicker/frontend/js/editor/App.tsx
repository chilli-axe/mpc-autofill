import * as React from "react";
import { CardGrid } from "./cardGrid";
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
          <div className="sticky-top sticky-offset g-0"></div>
        </div>
      </div>
    </div>
  );
}

export default App;
