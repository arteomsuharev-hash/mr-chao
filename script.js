// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

let selectedTime = null;
let bookings = [];

// DOM элементы
const form = document.getElementById('bookingForm');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const serviceSelect = document.getElementById('service');
const dateInput = document.getElementById('date');
const timeSlotsDiv = document.getElementById('timeSlots');
const submitBtn = document.getElementById('submitBtn');
const notificationDiv = document.getElementById('notification');

// Установка минимальной даты
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
dateInput.min = tomorrow.toISOString().split('T')[0];

// Загрузка записей из Telegram Cloud Storage
function loadBookings() {
    tg.CloudStorage.getItem('bookings', (error, value) => {
        if (!error && value) {
            try {
                bookings = JSON.parse(value);
            } catch(e) {
                bookings = [];
            }
        } else {
            bookings = [];
        }
    });
}

// Сохранение записей
function saveBookingsToStorage() {
    tg.CloudStorage.setItem('bookings', JSON.stringify(bookings));
}

// Получение свободных слотов
function getAvailableSlots(date) {
    const bookedTimes = bookings
        .filter(b => b.date === date)
        .map(b => b.time);
    
    const allSlots = [
        '10:00', '11:00', '12:00', '13:00', 
        '14:00', '15:00', '16:00', '17:00', 
        '18:00', '19:00', '20:00'
    ];
    
    return allSlots.filter(slot => !bookedTimes.includes(slot));
}

// Отображение слотов
function displayAvailableSlots(date) {
    const slots = getAvailableSlots(date);
    
    if (slots.length === 0) {
        timeSlotsDiv.innerHTML = '<div class="time-placeholder">❌ НЕТ СВОБОДНОГО ВРЕМЕНИ</div>';
        return;
    }
    
    timeSlotsDiv.innerHTML = '';
    selectedTime = null;
    
    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'time-slots';
    
    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = 'time-slot';
        slotElement.textContent = slot;
        slotElement.onclick = () => {
            document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
            slotElement.classList.add('selected');
            selectedTime = slot;
            if (navigator.vibrate) navigator.vibrate(50);
        };
        slotsContainer.appendChild(slotElement);
    });
    
    timeSlotsDiv.appendChild(slotsContainer);
}

// Показ уведомления
function showNotification(message, type) {
    notificationDiv.innerHTML = `<div class="notification ${type}">${message}</div>`;
    setTimeout(() => {
        notificationDiv.innerHTML = '';
    }, 3000);
}

// Управление кнопкой
function setButtonLoading(isLoading) {
    const btnText = document.querySelector('.btn-text');
    const btnLoading = document.querySelector('.btn-loading');
    const btnArrow = document.querySelector('.btn-arrow');
    
    if (isLoading) {
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        if (btnArrow) btnArrow.style.display = 'none';
    } else {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        if (btnArrow) btnArrow.style.display = 'inline';
    }
}

// Форматирование телефона
phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length === 11) {
        value = value.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 ($2) $3-$4-$5');
    } else if (value.length > 0) {
        value = '+' + value;
    }
    e.target.value = value;
});

// Загрузка
loadBookings();

// Обработчик даты
dateInput.addEventListener('change', () => {
    if (dateInput.value) {
        displayAvailableSlots(dateInput.value);
    }
});

// Отправка формы
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const service = serviceSelect.value;
    const date = dateInput.value;
    
    // Валидация
    if (!name) {
        showNotification('❌ УКАЖИ ИМЯ', 'error');
        nameInput.focus();
        return;
    }
    
    if (!phone) {
        showNotification('❌ УКАЖИ ТЕЛЕФОН', 'error');
        phoneInput.focus();
        return;
    }
    
    if (!service || service === '') {
        showNotification('❌ ВЫБЕРИ УСЛУГУ', 'error');
        return;
    }
    
    if (!date) {
        showNotification('❌ ВЫБЕРИ ДАТУ', 'error');
        dateInput.focus();
        return;
    }
    
    if (!selectedTime) {
        showNotification('❌ ВЫБЕРИ ВРЕМЯ', 'error');
        return;
    }
    
    // Проверка телефона
    const phoneRegex = /^\+?\d[\d\s\-\(\)]{9,}$/;
    if (!phoneRegex.test(phone)) {
        showNotification('❌ НЕКОРРЕКТНЫЙ ТЕЛЕФОН', 'error');
        return;
    }
    
    // Проверка времени
    const availableSlots = getAvailableSlots(date);
    if (!availableSlots.includes(selectedTime)) {
        showNotification('❌ ЭТО ВРЕМЯ УЖЕ ЗАНЯТО', 'error');
        displayAvailableSlots(date);
        return;
    }
    
    // Сохраняем запись
    const newBooking = {
        id: Date.now(),
        name: name,
        phone: phone,
        service: service,
        date: date,
        time: selectedTime,
        createdAt: new Date().toLocaleString('ru-RU')
    };
    
    bookings.push(newBooking);
    saveBookingsToStorage();
    
    // Отправляем в Telegram
    const message = `🔴 НОВАЯ ЗАПИСЬ!\n\n` +
        `◉ Имя: ${name}\n` +
        `◉ Телефон: ${phone}\n` +
        `◉ Услуга: ${service}\n` +
        `◉ Дата: ${date}\n` +
        `◉ Время: ${selectedTime}`;
    
    tg.sendData(message);
    
    showNotification('✅ ЗАЯВКА ОТПРАВЛЕНА! МАСТЕР СВЯЖЕТСЯ С ТОБОЙ.', 'success');
    
    setTimeout(() => {
        form.reset();
        selectedTime = null;
        timeSlotsDiv.innerHTML = '<div class="time-placeholder">ВЫБЕРИ ДАТУ</div>';
        tg.close();
    }, 2000);
});

// Приветствие
setTimeout(() => {
    showNotification('⚔️ ДОБРО ПОЖАЛОВАТЬ В MR. CHAO TATTOO ⚔️', 'success');
}, 500);
