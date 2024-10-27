// src/components/Header.js

import React from "react";
import logo from "./logo.svg";
const Header = () => {
  return (
    <header className="bg-white p-4 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <img src={logo} className="h-10 mr-1" alt="Logo" />
          <h1 className="text-2xl font-bold">My Restaurant</h1>
        </div>
        <nav>
          <a href="/" className="mr-4 hover:text-gray-300">
            Home
          </a>
          <a href="/cart" className="mr-4 hover:text-gray-300">
            Cart
          </a>
          <a href="/admin" className="hover:text-gray-300">
            Admin
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
