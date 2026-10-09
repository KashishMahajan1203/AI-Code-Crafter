import React from "react";
import { Link } from "react-router-dom";
import { LuSparkles } from "react-icons/lu";

const Brand = ({ to = "/", tagline = "AI component studio" }) => (
  <Link className="brand" to={to} aria-label="CodeCrafter home">
    <span className="brand-mark">
      <LuSparkles />
    </span>

    <span className="brand-copy">
      <strong>CodeCrafter</strong>
      <span>{tagline}</span>
    </span>
  </Link>
);

export default Brand;
