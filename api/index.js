const fs = require('fs');
const path = require('path');

// Путь к файлу с записями
const BOOKINGS_FILE = path.join(__dirname, '../data/bookings.json');

// Загрузка записей
function loadBookings() {
    if (!fs.existsSync(BOOKINGS_FILE)) {
        return { bookings: [] };
    }
    const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
    return JSON.parse(data);
}

// Сохранение записи
function saveBooking(booking) {
    const data = loadBookings();
    data.bookings.push(booking);
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2));
}

// Получение свободных слотов
function getAvailableSlots(date) {
    const data = loadBookings();
    const bookedTimes = data.bookings
        .filter(b => b.date === date)
        .map(b => b.time);
    
    const allSlots = [
        '10:00', '11:00', '12:00', '13:00', 
        '14:00', '15:00', '16:00', '17:00', 
        '18:00', '19:00', '20:00'
    ];
    
    return allSlots.filter(slot => !bookedTimes.includes(slot));
}

module.exports = async (req, res) => {
    // CORS для безопасности
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // GET /api/slots - получение свободных слотов
    if (req.method === 'GET' && url.pathname === '/api/slots') {
        const date = url.searchParams.get('date');
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        
        const slots = getAvailableSlots(date);
        return res.status(200).json({ slots });
    }
    
    // POST /api/book - создание записи
    if (req.method === 'POST' && url.pathname === '/api/book') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const { name, phone, service, date, time } = JSON.parse(body);
                
                // Валидация
                if (!name || !phone || !service || !date || !time) {
                    return res.status(400).json({ error: 'All fields are required' });
                }
                
                // Проверка на занятость
                const availableSlots = getAvailableSlots(date);
                if (!availableSlots.includes(time)) {
                    return res.status(400).json({ error: 'Это время уже занято!' });
                }
                
                // Сохраняем запись
                const booking = {
                    id: Date.now(),
                    name,
                    phone,
                    service,
                    date,
                    time,
                    createdAt: new Date().toISOString()
                };
                
                saveBooking(booking);
                
                // Здесь можно добавить отправку в Google Sheets
                // и уведомление в Telegram
                
                return res.status(200).json({ 
                    success: true, 
                    message: 'Запись создана!',
                    booking 
                });
                
            } catch (error) {
                console.error('Error:', error);
                return res.status(500).json({ error: 'Internal server error' });
            }
        });
        
        return;
    }
    
    // 404 для неизвестных маршрутов
    res.status(404).json({ error: 'Not found' });
};
