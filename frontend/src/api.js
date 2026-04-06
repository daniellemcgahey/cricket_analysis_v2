import axios from "axios";

const baseURL = process.env.REACT_APP_API_BASE_URL;

if (!baseURL) {
  throw new Error("REACT_APP_API_BASE_URL is not defined");
}

const api = axios.create({
  baseURL,
});

export default api;