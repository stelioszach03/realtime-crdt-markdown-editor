// Disable all console methods in production for performance
export const disableConsoleInProduction = () => {
  const noop = () => {};
  
  // In development, only disable warnings to clean up React Router warnings
  if (import.meta.env.DEV) {
    console.warn = noop;  // Disable React Router warnings
    return;
  }
  
  // In production, disable everything
  console.log = noop;
  console.warn = noop;
  console.error = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
  console.dir = noop;
  console.dirxml = noop;
  console.group = noop;
  console.groupEnd = noop;
  console.time = noop;
  console.timeEnd = noop;
  console.assert = noop;
  console.profile = noop;
};