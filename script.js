// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Глобальные переменные
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

// Установка минимальной даты (завтра)
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

// Сохранение записей в Telegram Cloud Storage
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

// Отображение свободных слотов
function displayAvailableSlots(date) {
    const slots = getAvailableSlots(date);
    
    if (slots.length === 0) {
        timeSlotsDiv.innerHTML = '<div class="loading-spinner">😔 На эту дату нет свободного времени</div>';
        return;
    }
    
    timeSlotsDiv.innerHTML = '';
    selectedTime = null;
    
    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = 'time-slot';
        slotElement.textContent = slot;
        slotElement.onclick = () => selectTimeSlot(slotElement, slot);
        timeSlotsDiv.appendChild(slotElement);
    });
}

// Выбор временного слота
function selectTimeSlot(element, time) {
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    
    element.classList.add('selected');
    selectedTime = time;
    
    // Вибрация на телефоне
    if (navigator.vibrate) navigator.vibrate(50);
}

// Показ уведомления
function showNotification(message, type) {
    notificationDiv.innerHTML = `<div class="notification ${type}">${message}</div>`;
    setTimeout(() => {
        notificationDiv.innerHTML = '';
    }, 3000);
}

// Управление состоянием кнопки
function setButtonLoading(isLoading) {
    const btnText = document.querySelector('.btn-text');
    const btnLoading = document.querySelector('.btn-loading');
    
    if (isLoading) {
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
    } else {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// Загрузка записей при старте
loadBookings();

// Обработчик изменения даты
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
        showNotification('Пожалуйста, укажите ваше имя', 'error');
        nameInput.focus();
        return;
    }
    
    if (!phone) {
        showNotification('Пожалуйста, укажите телефон для связи', 'error');
        phoneInput.focus();
        return;
    }
    
    if (!service) {
        showNotification('Пожалуйста, выберите услугу', 'error');
        serviceSelect.focus();
        return;
    }
    
    if (!date) {
        showNotification('Пожалуйста, выберите дату', 'error');
        dateInput.focus();
        return;
    }
    
    if (!selectedTime) {
        showNotification('Пожалуйста, выберите время', 'error');
        return;
    }
    
    // Проверка телефона
    const phoneRegex = /^[\+\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
        showNotification('Укажите корректный номер телефона', 'error');
        return;
    }
    
    // Проверка что время ещё свободно
    const availableSlots = getAvailableSlots(date);
    if (!availableSlots.includes(selectedTime)) {
        showNotification('Это время уже занято! Выберите другое', 'error');
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
    
    // Отправляем уведомление мастеру в Telegram
    const message = `🔔 НОВАЯ ЗАПИСЬ!\n\n` +
        `👤 Имя: ${name}\n` +
        `📞 Телефон: ${phone}\n` +
        `🎨 Услуга: ${service}\n` +
        `📅 Дата: ${date}\n` +
        `⏰ Время: ${selectedTime}`;
    
    tg.sendData(message);
    
    showNotification('✅ Запись создана! Мастер свяжется с вами.', 'success');
    
    // Очищаем форму и закрываем
    setTimeout(() => {
        form.reset();
        selectedTime = null;
        timeSlotsDiv.innerHTML = '<div class="loading-spinner">📅 Выберите дату для просмотра свободного времени</div>';
        tg.close();
    }, 2000);
});

// Приветствие при загрузке
setTimeout(() => {
    showNotification('👋 Добро пожаловать! Выберите удобное время', 'success');
}, 500);
