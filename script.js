// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Глобальные переменные
let selectedTime = null;
let currentDate = null;

// DOM элементы
const form = document.getElementById('bookingForm');
const dateInput = document.getElementById('date');
const timeSlotsDiv = document.getElementById('timeSlots');
const submitBtn = document.getElementById('submitBtn');
const notificationDiv = document.getElementById('notification');

// Установка минимальной даты (сегодня + 1 день)
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
dateInput.min = tomorrow.toISOString().split('T')[0];

// Обработчик изменения даты
dateInput.addEventListener('change', async (e) => {
    currentDate = e.target.value;
    if (currentDate) {
        await loadAvailableSlots(currentDate);
    }
});

// Загрузка свободных слотов
async function loadAvailableSlots(date) {
    try {
        timeSlotsDiv.innerHTML = '<div class="loading-spinner">⏳ Загрузка свободного времени...</div>';
        
        const response = await fetch(`/api/slots?date=${date}`);
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }
        
        const data = await response.json();
        
        if (!data.slots || data.slots.length === 0) {
            timeSlotsDiv.innerHTML = '<div class="loading-spinner">😔 На эту дату нет свободного времени</div>';
            return;
        }
        
        // Отображаем слоты
        displayTimeSlots(data.slots);
        
    } catch (error) {
        console.error('Ошибка загрузки слотов:', error);
        timeSlotsDiv.innerHTML = '<div class="loading-spinner">❌ Ошибка загрузки. Попробуйте позже</div>';
        showNotification('Не удалось загрузить свободное время', 'error');
    }
}

// Отображение временных слотов
function displayTimeSlots(slots) {
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
    // Убираем выделение с предыдущего
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    
    // Выделяем выбранный
    element.classList.add('selected');
    selectedTime = time;
    
    // Вибрация на мобильных устройствах (опционально)
    if (tg.platform !== 'unknown' && navigator.vibrate) {
        navigator.vibrate(50);
    }
}

// Отправка формы
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Сбор данных
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const service = document.getElementById('service').value;
    const date = dateInput.value;
    
    // Валидация
    if (!name) {
        showNotification('Пожалуйста, укажите ваше имя', 'error');
        document.getElementById('name').focus();
        return;
    }
    
    if (!phone) {
        showNotification('Пожалуйста, укажите телефон для связи', 'error');
        document.getElementById('phone').focus();
        return;
    }
    
    if (!service) {
        showNotification('Пожалуйста, выберите услугу', 'error');
        document.getElementById('service').focus();
        return;
    }
    
    if (!date) {
        showNotification('Пожалуйста, выберите дату', 'error');
        dateInput.focus();
        return;
    }
    
    if (!selectedTime) {
        showNotification('Пожалуйста, выберите удобное время', 'error');
        return;
    }
    
    // Валидация телефона (простая)
    const phoneRegex = /^[\+\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
        showNotification('Пожалуйста, укажите корректный номер телефона', 'error');
        return;
    }
    
    // Отправка данных
    await submitBooking({ name, phone, service, date, time: selectedTime });
});

// Отправка записи на сервер
async function submitBooking(bookingData) {
    // Блокируем кнопку
    setButtonLoading(true);
    
    try {
        const response = await fetch('/api/book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Успешная запись
            showNotification('✅ Запись создана! Мастер свяжется с вами для подтверждения.', 'success');
            
            // Отправляем подтверждение в Telegram
            tg.sendData(JSON.stringify({
                success: true,
                message: `Запись на ${bookingData.date} ${bookingData.time}`
            }));
            
            // Очищаем форму
            setTimeout(() => {
                form.reset();
                selectedTime = null;
                timeSlotsDiv.innerHTML = '<div class="loading-spinner">📅 Выберите дату для просмотра свободного времени</div>';
                tg.close(); // Закрываем мини-приложение через 2 секунды
            }, 2000);
            
        } else {
            // Ошибка при создании записи
            showNotification(result.error || 'Ошибка при создании записи. Попробуйте еще раз.', 'error');
            
            // Если время занято, перезагружаем слоты
            if (result.error && result.error.includes('занято')) {
                await loadAvailableSlots(bookingData.date);
            }
            
            setButtonLoading(false);
        }
        
    } catch (error) {
        console.error('Ошибка отправки:', error);
        showNotification('❌ Ошибка соединения. Проверьте интернет и попробуйте снова.', 'error');
        setButtonLoading(false);
    }
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

// Показ уведомлений
function showNotification(message, type) {
    notificationDiv.innerHTML = `
        <div class="notification ${type}">
            ${message}
        </div>
    `;
    
    // Автоматическое скрытие через 4 секунды
    setTimeout(() => {
        notificationDiv.innerHTML = '';
    }, 4000);
}

// Обработка темы Telegram
tg.onEvent('themeChanged', () => {
    // Принудительно обновляем цвета
    document.body.style.backgroundColor = tg.themeParams.bg_color || '#ffffff';
});

// Показать приветствие при загрузке
console.log('Mini App загружен');
showNotification('👋 Добро пожаловать! Выберите удобное время для записи', 'success');
setTimeout(() => {
    notificationDiv.innerHTML = '';
}, 3000);
