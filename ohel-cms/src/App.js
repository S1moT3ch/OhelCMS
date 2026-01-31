import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import GoogleSheetReader from "./components/GoogleSheetReader";
import NotFoundPage from "./components/NotFoundPage";


function App() {
  return (
      <Router>
        <div>
          <Routes>
            <Route path="/" element={<GoogleSheetReader />} />7
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </Router>
  );
}

export default App;
