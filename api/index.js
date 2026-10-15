import { createServerlessHandler } from "../server/src/runtime.js";

// Vercel invokes this function; it does not start a persistent local listener.
export default createServerlessHandler();
