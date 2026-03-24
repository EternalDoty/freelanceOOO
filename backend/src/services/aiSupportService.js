const { OpenAI } = require('openai');
const db = require('../config/database');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const CONFIDENCE_THRESHOLD = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.7;

const FAQ_KNOWLEDGE_BASE = [
  {
    keywords: ['комиссия', 'fee', 'commission'],
    answer: 'Комиссия платформы динамическая: 1% для сумм до 10,000₽, 0.8% для 10,000-50,000₽, 0.5% для сумм свыше 50,000₽.'
  },
  {
    keywords: ['escrow', 'гарантия', 'безопасная сделка'],
    answer: 'Escrow - это система безопасных сделок. Заказчик резервирует средства, которые переводятся исполнителю после принятия работы.'
  },
  {
    keywords: ['блокировка', 'block', 'заблокирован'],
    answer: 'Для разблокировки аккаунта создайте апелляцию в разделе поддержки. Приложите доказательства и описание ситуации.'
  },
  {
    keywords: ['апелляция', 'appeal', 'обжалование'],
    answer: 'Апелляции рассматриваются модераторами в течение 48 часов. Статус можно отслеивать в личном кабинете.'
  },
  {
    keywords: ['рейтинг', 'отзыв', 'review'],
    answer: 'Рейтинг формируется на основе отзывов от заказчиков. При подозрении на необоснованные оценки рейтинг может быть заморожен.'
  }
];

async function findFAQAnswer(question) {
  const questionLower = question.toLowerCase();
  
  for (const faq of FAQ_KNOWLEDGE_BASE) {
    if (faq.keywords.some(keyword => questionLower.includes(keyword))) {
      return {
        answer: faq.answer,
        confidence: 0.9,
        source: 'faq'
      };
    }
  }
  
  return null;
}

async function generateAIResponse(messages, context = {}) {
  try {
    const systemPrompt = `Ты - помощник поддержки фриланс-платформы. 
    Отвечай вежливо и профессионально на русском языке.
    Если не уверен в ответе, предложи создать тикет для оператора.
    
    Контекст пользователя:
    - Роль: ${context.role || 'неизвестно'}
    - Активных задач: ${context.activeTasks || 0}
    - Рейтинг: ${context.rating || 'нет'}
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const response = completion.choices[0].message.content;
    
    // Calculate confidence based on response quality
    const confidence = calculateConfidence(response, messages);
    
    return {
      answer: response,
      confidence,
      source: 'ai'
    };
  } catch (error) {
    console.error('AI Response Error:', error);
    return {
      answer: 'Извините, возникла техническая ошибка. Пожалуйста, создайте тикет для оператора.',
      confidence: 0,
      source: 'error'
    };
  }
}

function calculateConfidence(response, messages) {
  // Simple confidence calculation based on response length and keywords
  const positiveKeywords = ['помочь', 'решение', 'ответ', 'информация'];
  const negativeKeywords = ['не знаю', 'не могу', 'ошибка', 'проблема'];
  
  const responseLower = response.toLowerCase();
  
  let score = 0.5;
  
  if (response.length > 100) score += 0.2;
  if (positiveKeywords.some(k => responseLower.includes(k))) score += 0.2;
  if (negativeKeywords.some(k => responseLower.includes(k))) score -= 0.3;
  
  return Math.max(0, Math.min(1, score));
}

async function createSupportTicket(userId, subject, messages, category = 'general') {
  const result = await db.query(
    `INSERT INTO support_tickets (user_id, subject, category, messages, status)
     VALUES ($1, $2, $3, $4, 'open')
     RETURNING *`,
    [userId, subject, category, JSON.stringify(messages)]
  );
  
  return result.rows[0];
}

async function processSupportMessage(ticketId, userId, message) {
  const ticket = await db.query(
    'SELECT * FROM support_tickets WHERE id = $1',
    [ticketId]
  );
  
  if (ticket.rows.length === 0) {
    throw new Error('Ticket not found');
  }
  
  const ticketData = ticket.rows[0];
  const messages = ticketData.messages || [];
  messages.push({ role: 'user', content: message, timestamp: new Date() });
  
  // Try FAQ first
  const faqAnswer = await findFAQAnswer(message);
  
  if (faqAnswer) {
    messages.push({ role: 'assistant', content: faqAnswer.answer, timestamp: new Date() });
    
    await db.query(
      `UPDATE support_tickets 
       SET messages = $1, status = 'ai_responded', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(messages), ticketId]
    );
    
    return {
      response: faqAnswer.answer,
      confidence: faqAnswer.confidence,
      escalate: false
    };
  }
  
  // Get user context
  const userContext = await db.query(
    `SELECT role, rating, 
            (SELECT COUNT(*) FROM tasks WHERE customer_id = $1) as active_tasks
     FROM users WHERE id = $1`,
    [userId]
  );
  
  // Generate AI response
  const aiResponse = await generateAIResponse(messages, userContext.rows[0]);
  messages.push({ 
    role: 'assistant', 
    content: aiResponse.answer, 
    timestamp: new Date(),
    confidence: aiResponse.confidence 
  });
  
  // Determine if escalation is needed
  const escalate = aiResponse.confidence < CONFIDENCE_THRESHOLD;
  
  if (escalate) {
    await db.query(
      `UPDATE support_tickets 
       SET messages = $1, status = 'human_assigned', ai_confidence = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(messages), aiResponse.confidence, ticketId]
    );
  } else {
    await db.query(
      `UPDATE support_tickets 
       SET messages = $1, status = 'ai_responded', ai_confidence = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(messages), aiResponse.confidence, ticketId]
    );
  }
  
  return {
    response: aiResponse.answer,
    confidence: aiResponse.confidence,
    escalate
  };
}

async function assignTicketToModerator(ticketId, moderatorId) {
  await db.query(
    `UPDATE support_tickets 
     SET assigned_moderator = $1, status = 'human_assigned', updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [moderatorId, ticketId]
  );
}

async function closeTicket(ticketId, moderatorId) {
  await db.query(
    `UPDATE support_tickets 
     SET status = 'closed', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ticketId]
  );
}

module.exports = {
  findFAQAnswer,
  generateAIResponse,
  createSupportTicket,
  processSupportMessage,
  assignTicketToModerator,
  closeTicket,
  CONFIDENCE_THRESHOLD
};