import axios from "axios";
const AI_API_URL = "http://localhost:8000";

export const aiService = {
  async predict(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${AI_API_URL}/predict`, formData);

      return response.data;
    } catch (error) {
      console.error("AI Prediction Error:", error);
      throw error;
    }
  },
};
