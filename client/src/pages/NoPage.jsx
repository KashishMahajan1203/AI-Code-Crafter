import React from "react";
import { Link } from "react-router-dom";
import { LuArrowLeft } from "react-icons/lu";
import Brand from "../components/Brand";

const NoPage = () => (
  <div className="not-found">
    <Brand />

    <main>
      <span className="not-found-code" aria-hidden="true">
        404
      </span>
      <h1>This page wasn't generated.</h1>
      <p>The link may be broken, or the page may have moved.</p>

      <Link className="primary-cta" to="/">
        <LuArrowLeft /> Back to home
      </Link>
    </main>
  </div>
);

export default NoPage;
