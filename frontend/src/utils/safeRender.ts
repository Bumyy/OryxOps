import React from "react";

/**
 * Safely converts any value into a React-renderable node (string, number, or JSX element).
 * Prevents React Error #31 ("Objects are not valid as a React child").
 */
export function safeRender(val: any, fallback: React.ReactNode = "—"): React.ReactNode {
  if (val === null || val === undefined) return fallback;
  
  // Allow valid React elements (e.g. <span>...</span>)
  if (React.isValidElement(val)) return val;
  
  // If it's a plain object or array, it cannot be rendered directly in JSX
  if (typeof val === "object") return fallback;
  
  const str = String(val).trim();
  if (!str || str === "[object Object]") return fallback;
  return str;
}

/**
 * Safely converts a value to a string, returning a fallback if it is an object, null, or undefined.
 */
export function safeString(val: any, fallback = ""): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return fallback;
  const str = String(val).trim();
  if (!str || str === "[object Object]") return fallback;
  return str;
}
