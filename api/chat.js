const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
    
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ reply: text });

  } catch (error) {

    console.error('Erro no servidor da API:', error);
    res.status(500).json({ error: 'Falha ao se comunicar com a IA.' });
  }
}
