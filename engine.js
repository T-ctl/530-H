// engine.js — полная логика интерфейса, соответствующая приказу 530н
// Подключается после config.js

// ========== УТИЛИТЫ ==========
function convertLayout(str) {
    const ru = "йцукенгшщзхъфывапролджэячсмитьбюё";
    const en = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
    const ruUpper = ru.toUpperCase();
    const enUpper = en.toUpperCase();
    let res = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        let idx = en.indexOf(ch);
        if (idx !== -1) { res += ru[idx]; continue; }
        idx = enUpper.indexOf(ch);
        if (idx !== -1) { res += ruUpper[idx]; continue; }
        idx = ru.indexOf(ch);
        if (idx !== -1) { res += en[idx]; continue; }
        idx = ruUpper.indexOf(ch);
        if (idx !== -1) { res += enUpper[idx]; continue; }
        res += ch;
    }
    return res;
}

function setupAutocomplete(inputElement, dictionary) {
    if (!inputElement) return;
    const wrapper = inputElement.parentElement;
    let dropdown = wrapper.querySelector('.autocomplete-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('ul');
        dropdown.className = 'autocomplete-dropdown';
        wrapper.appendChild(dropdown);
    }
    function hide() {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
    }
    inputElement.addEventListener('input', function () {
        const query = this.value.trim();
        if (query.length < 2) { hide(); return; }
        const normalizedQuery = query.toLowerCase();
        const altQuery = convertLayout(query).toLowerCase();
        const matches = dictionary.filter(item => {
            const lower = item.toLowerCase();
            return lower.startsWith(normalizedQuery) || lower.startsWith(altQuery) || lower.includes(normalizedQuery) || lower.includes(altQuery);
        });
        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(m => `<li>${m}</li>`).join('');
            dropdown.style.display = 'block';
        } else {
            hide();
        }
    });
    inputElement.addEventListener('blur', () => { setTimeout(hide, 200); });
    dropdown.addEventListener('mousedown', function (e) {
        if (e.target.tagName === 'LI') {
            inputElement.value = e.target.textContent;
            hide();
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
}

function calcBMI() {
    const h = parseFloat(document.getElementById('heightInput').value) / 100;
    const w = parseFloat(document.getElementById('weightInput').value);
    if (h > 0 && w > 0) {
        const bmi = (w / (h * h)).toFixed(1);
        state.dynamicFields['bmi'] = bmi;
        if (bmi >= 30) {
            let degree = 'I';
            if (bmi >= 40) degree = 'III';
            else if (bmi >= 35) degree = 'II';
            const idx = state.chronicExpanded.findIndex(c => c.key === 'Ожирение');
            if (idx === -1) {
                state.chronicExpanded.push({ key: 'Ожирение', base: 'Ожирение', fields: { degree, bmi }, _auto: true });
                renderChronicTags(); updateConcomitantAndMeds();
            } else {
                state.chronicExpanded[idx].fields.degree = degree;
                state.chronicExpanded[idx].fields.bmi = bmi;
                renderChronicTags(); updateConcomitantAndMeds();
            }
        }
        updatePreview();
    }
}

function checkVitals() {
    const spo2 = parseFloat(document.getElementById('spo2Input').value) || 0;
    highlightVital('vitalSpO2', spo2 > 0 && spo2 < 92, spo2 < 90);
    const ad = document.getElementById('adInput').value.trim();
    if (ad && ad.includes('/')) {
        const [s, d] = ad.split('/').map(Number);
        highlightVital('vitalAD', s < 90 || d < 60, s < 80);
    }
}

function highlightVital(id, cond, dang) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('warning', 'danger');
    if (dang) el.classList.add('danger');
    else if (cond) el.classList.add('warning');
}

function toggleLN() {
    document.getElementById('lnDateContainer').style.display = document.getElementById('lnCheckbox').checked ? 'inline-flex' : 'none';
}

function checkFLG() {
    const y = parseInt(document.getElementById('flgYear').value),
          m = parseInt(document.getElementById('flgMonth').value);
    const w = document.getElementById('flgWarning');
    if (!y || !m) { w.style.display = 'none'; return; }
    const flgDate = new Date(y, m - 1, 1);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const expired = flgDate < oneYearAgo;
    w.style.display = expired ? 'inline' : 'none';
    if (expired) addToExamPlanIfMissing('лучевые методы обследования');
}

function addToExamPlanIfMissing(text) {
    const examField = document.getElementById('examPlan');
    if (!examField) return;
    const current = examField.value;
    if (!current.toLowerCase().includes(text.toLowerCase())) {
        examField.value = current.trim() + (current.trim() ? ', ' : '') + text;
        state.dynamicFields['examPlan'] = examField.value;
        autoResize(examField);
        updatePreview();
    }
}

function toggleCheckDetail(id) {
    const chk = document.getElementById('chk' + id.charAt(0).toUpperCase() + id.slice(1));
    const det = document.getElementById('detail' + id.charAt(0).toUpperCase() + id.slice(1));
    if (!chk || !det) return;
    det.style.display = chk.checked ? 'block' : 'none';
    if (!chk.checked) {
        if (id === 'vener') { state.infections.vener = ''; state.infections.venerYear = ''; }
        else if (id === 'glist') { state.infections.glist = ''; state.infections.glistYear = ''; }
        else state.infections[id] = '';
        const inputs = det.querySelectorAll('input');
        inputs.forEach(inp => inp.value = '');
    }
    updatePreview();
}

function updateCheckField(id, val) {
    if (id === 'venerYear') state.infections.venerYear = val;
    else if (id === 'glistYear') state.infections.glistYear = val;
    else state.infections[id] = val;
    updatePreview();
}

function buildInfectionsText() {
    const inf = state.infections;
    const parts = [];
    if (inf.tbc) parts.push(`Туберкулез ${inf.tbc} год`);
    if (inf.malaria) parts.push(`Малярия ${inf.malaria} год`);
    if (inf.hiv) parts.push(`ВИЧ-инфекция ИБ+ от ${inf.hiv} года`);
    if (inf.vener) { let t = inf.vener; if (inf.venerYear) t += ` ${inf.venerYear} год`; parts.push(t); }
    if (inf.glist) { let t = inf.glist; if (inf.glistYear) t += ` ${inf.glistYear} год`; parts.push(t); }
    if (inf.hvg) parts.push(`Хронический гепатит "${inf.hvg}"`);
    if (inf.covid) parts.push(`Коронавирусная инфекция ${inf.covid} год`);
    if (parts.length === 0) return 'Туберкулез, малярию, ВИЧ-инфекцию, венерические заболевания, глистные инвазии, хронические вирусные гепатиты, эпилепсию — отрицает.';
    return parts.join('. ') + '.';
}

function getPregnancyWeeks(chronicEntry) {
    if (!chronicEntry || !chronicEntry.fields || !chronicEntry.fields.weeks) return null;
    const raw = chronicEntry.fields.weeks.trim();
    const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
    const singleMatch = raw.match(/^(\d+)$/);
    if (singleMatch) { const val = parseInt(singleMatch[1]); return { min: val, max: val }; }
    return null;
}

function extractStoolNumberFromDynamics(dynamicsText) {
    const match = dynamicsText.match(/(?:стул\s*(?:до\s*)?|кратность\s+стула\s*)\s*(\d+)/i);
    return match ? match[1] : null;
}

// ========== ДИНАМИЧЕСКИЙ КОНСТРУКТОР ЖАЛОБ ==========
function normalizeForComparison(text) {
    return text
        .toLowerCase()
        .replace(/\d+([.,]\d+)?/g, '')
        .replace(/[,\s]+/g, ' ')
        .trim();
}

function renderSymptomButtons() {
    const container = document.getElementById('symptomButtons');
    const currentRaw = document.getElementById('currentComplaintsField').value;
    const currentNormalized = normalizeForComparison(currentRaw);
    container.innerHTML = '';
    const order = ['слабость', 'недомогание', 'повышение температуры', 'тошнота', 'рвота', 'жидкий стул', 'кашель', 'одышка', 'головная боль', 'боли в животе', 'снижение диуреза', 'боль в горле'];
    for (const key of order) {
        if (!SYMPTOM_TREE[key]) continue;
        const templateText = SYMPTOM_TREE[key].addText.replace(/\{N\}/g, '');
        const templateNormalized = normalizeForComparison(templateText);
        if (currentNormalized.includes(templateNormalized)) continue;
        const btn = document.createElement('button');
        btn.className = 'symptom-btn';
        btn.textContent = key;
        btn.onclick = () => addSymptom(key);
        container.appendChild(btn);
    }
}

function addSymptom(key) {
    const symptom = SYMPTOM_TREE[key];
    if (!symptom) return;
    if (symptom.ask && symptom.ask.type === 'number') {
        promptForNumber(key);
    } else {
        addSymptomText(symptom.addText);
        if (symptom.next && symptom.next.length > 0) {
            showDynamicSuggestions(symptom.next);
        }
        checkDiagnosisTriggers();
    }
}

function addSymptomText(text) {
    const field = document.getElementById('currentComplaintsField');
    let current = field.value.trim();
    if (current && !/[,\s]$/.test(current)) current += ', ';
    field.value = current + text;
    updateField('currentComplaints', field.value);
    autoResize(field);
    renderSymptomButtons();
    updateSymptomHints();
    checkDiagnosisTriggers();
}

function promptForNumber(symptomKey) {
    const symptom = SYMPTOM_TREE[symptomKey];
    if (!symptom || !symptom.ask) return;
    const ask = symptom.ask;
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width:300px;">
            <p>${ask.question}</p>
            <input type="text" id="numberInput" placeholder="${ask.placeholder}" inputmode="numeric" style="width:100%; margin-bottom:10px;">
            <div style="display:flex; gap:8px; justify-content:center;">
                <button class="btn btn-primary" id="confirmNumberBtn">Добавить</button>
                <button class="btn btn-secondary" id="cancelNumberBtn">Отмена</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const input = document.getElementById('numberInput');
    input.focus();

    input.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9.,\-\/]/g, '');
    });

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('confirmNumberBtn').click();
        }
    });

    document.getElementById('confirmNumberBtn').onclick = () => {
        let raw = input.value.trim();
        if (!raw) { overlay.remove(); return; }
        raw = raw.replace(/[,\/]/g, '.').replace(/[^0-9.\-]/g, '');
        const isValid = /^(\d+(\.\d+)?)(\s*-\s*(\d+(\.\d+)?))?$/.test(raw);
        if (isValid) {
            let formatted = raw.replace(/\s*-\s*/g, '-');
            const text = symptom.addText.replace('{N}', formatted);
            addSymptomText(text);
            if (symptom.next && symptom.next.length > 0) {
                showDynamicSuggestions(symptom.next);
            }
        }
        overlay.remove();
    };
    document.getElementById('cancelNumberBtn').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function showDynamicSuggestions(symptoms) {
    const container = document.getElementById('dynamicSuggestions');
    const currentRaw = document.getElementById('currentComplaintsField').value;
    const currentNormalized = normalizeForComparison(currentRaw);
    container.innerHTML = '';
    symptoms.forEach(key => {
        if (!SYMPTOM_TREE[key]) return;
        const templateText = SYMPTOM_TREE[key].addText.replace(/\{N\}/g, '');
        const templateNormalized = normalizeForComparison(templateText);
        if (currentNormalized.includes(templateNormalized)) return;
        const btn = document.createElement('button');
        btn.className = 'symptom-btn';
        btn.textContent = key;
        btn.onclick = () => addSymptom(key);
        container.appendChild(btn);
    });
}

function updateSymptomHints() {
    const field = document.getElementById('currentComplaintsField');
    const val = field.value.trim().toLowerCase();
    const container = document.getElementById('complaintsShortcuts');
    container.innerHTML = '';
    if (!val) return;
    for (const [shortcut, data] of Object.entries(DIAGNOSIS_SHORTCUTS)) {
        if (val.startsWith(shortcut) || val.includes(shortcut)) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.textContent = `📋 Вставить жалобы для ${shortcut.toUpperCase()}`;
            btn.onclick = () => {
                field.value = data.template;
                updateField('currentComplaints', data.template);
                autoResize(field);
                renderSymptomButtons();
                if (!state.selectedDiagnosis || state.selectedDiagnosis.name !== data.diagKey) {
                    selectDiagnosis(data.diagKey);
                }
                updateDynamicBlock();
            };
            container.appendChild(btn);
            break;
        }
    }
}

function checkDiagnosisTriggers() {
    const complaints = document.getElementById('currentComplaintsField').value.toLowerCase();
    const container = document.getElementById('complaintsShortcuts');
    if (state.selectedDiagnosis && state.diagnosisConfirmed) return;
    for (const [diagKey, keywords] of Object.entries(DIAGNOSIS_TRIGGERS)) {
        const matches = keywords.filter(kw => complaints.includes(kw));
        if (matches.length >= 2) {
            if (container.querySelector(`[data-diag="${diagKey}"]`)) return;
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = `🩺 Предположить ${diagKey}`;
            btn.setAttribute('data-diag', diagKey);
            btn.onclick = () => {
                selectDiagnosis(diagKey);
                updateDynamicBlock();
            };
            container.appendChild(btn);
            break;
        }
    }
}

// ========== РАБОТА С ДИАГНОЗОМ ==========
function parseDiagnosis() {
    const inp = document.getElementById('diagnosisInput').value.trim().toUpperCase();
    const sug = document.getElementById('diagnosisSuggestion');
    sug.style.display = 'none';
    if (!inp) { state.selectedDiagnosis = null; updateUIAfterDiagnosis(); return; }
    const matches = [];
    const converted = convertLayout(inp).toUpperCase();
    for (const [k, v] of Object.entries(CONFIG.diagnosisMap)) {
        if (k.toUpperCase().includes(inp) || inp.includes(k.toUpperCase()) ||
            k.toUpperCase().includes(converted) || converted.includes(k.toUpperCase())) {
            matches.push({ key: k, ...v });
        }
    }
    if (matches.length > 0) {
        const m = matches[0];
        sug.style.display = 'block';
        sug.innerHTML = `<div class="diagnosis-suggestion" onclick="selectDiagnosis('${m.key}')">🔍 ${m.full}</div>`;
        if (m.key.toUpperCase() === inp || m.key.toUpperCase() === converted) selectDiagnosis(m.key);
    }
}

function selectDiagnosis(key) {
    const m = CONFIG.diagnosisMap[key.toUpperCase()] || CONFIG.diagnosisMap[key];
    if (!m) return;
    state.selectedDiagnosis = m;
    state.diagnosisConfirmed = false;
    document.getElementById('diagnosisInput').value = m.name;
    document.getElementById('diagnosisSuggestion').style.display = 'none';
    document.getElementById('confirmDiagnosisBtn').style.display = 'inline-block';
    document.getElementById('anamnesisPanel').style.display = 'block';
    document.getElementById('diagnosisSpecificPanel').style.display = 'block';
    document.getElementById('objectivePanel').style.display = 'block';
    document.getElementById('additionalInfoPanel').style.display = 'block';
    document.getElementById('planPanel').style.display = 'block';

    renderDiagnosisSpecificFields();

    const field = document.getElementById('currentComplaintsField');
    if (!state.dynamicFields['currentComplaints'] && field && !field.value.trim()) {
        const module = DIAGNOSIS_MODULES[m.type] || DIAGNOSIS_MODULES['default'];
        if (module.typicalComplaints) {
            field.value = module.typicalComplaints;
            updateField('currentComplaints', module.typicalComplaints);
        }
    }
    renderSymptomButtons();
    renderComplaintsShortcuts();
    updateDynamicBlock();

    if (m.examPlanTemplate) {
        document.getElementById('examPlan').value = m.examPlanTemplate;
        updateField('examPlan', m.examPlanTemplate);
    }
    if (m.treatmentPlanTemplate) {
        document.getElementById('treatmentPlan').value = m.treatmentPlanTemplate;
        updateField('treatmentPlan', m.treatmentPlanTemplate);
    }
    if (m.prescriptionsTemplate) {
        document.getElementById('prescriptions').value = m.prescriptionsTemplate;
        updateField('prescriptions', m.prescriptionsTemplate);
    }
    updateScores();
    updatePreview();
}

function confirmDiagnosis() {
    state.diagnosisConfirmed = true;
    document.getElementById('confirmDiagnosisBtn').style.display = 'none';
    updatePreview();
}

function updateUIAfterDiagnosis() {
    document.getElementById('confirmDiagnosisBtn').style.display = 'none';
    document.getElementById('anamnesisPanel').style.display = 'none';
    document.getElementById('diagnosisSpecificPanel').style.display = 'none';
    document.getElementById('objectivePanel').style.display = 'none';
    document.getElementById('additionalInfoPanel').style.display = 'none';
    document.getElementById('planPanel').style.display = 'none';
}

// ========== ОТРИСОВКА СПЕЦИФИЧНЫХ ПОЛЕЙ ДИАГНОЗА ==========
function renderDiagnosisSpecificFields() {
    const container = document.getElementById('diagnosisSpecificContent');
    const diag = state.selectedDiagnosis;
    if (!diag) { container.innerHTML = ''; return; }
    let html = '';
    if (diag.hasDehydration) {
        html += `
        <div class="form-row">
            <div class="form-group">
                <label>💧 Дегидратация</label>
                <select id="dehydrationGrade" onchange="updateField('dehydrationGrade', this.value); updateDynamicBlock()">
                    <option value="">—</option>
                    <option value="I">I степень</option>
                    <option value="II">II степень</option>
                    <option value="III">III степень</option>
                </select>
            </div>
            <div class="form-group">
                <label>🧪 Тип дегидратации</label>
                <select id="dehydrationType" onchange="updateField('dehydrationType', this.value)">
                    <option value="">—</option>
                    <option value="Изотонический" selected>Изотонический</option>
                    <option value="Гипертонический">Гипертонический</option>
                    <option value="Гипотонический">Гипотонический</option>
                </select>
            </div>
        </div>`;
    }
    if (diag.hasPneumoniaFields) {
        html += `
        <div class="form-row">
            <div class="form-group">
                <label>📍 Сторона поражения</label>
                <select id="pneumoniaSide" onchange="updatePneumoniaFields()">
                    <option value="правосторонняя">Правосторонняя</option>
                    <option value="левосторонняя">Левосторонняя</option>
                    <option value="полисегментарная">Полисегментарная (мультилобарная)</option>
                    <option value="двусторонняя">Двусторонняя</option>
                </select>
            </div>
            <div class="form-group">
                <label>🫁 Степень ДН</label>
                <select id="dnGrade" onchange="updatePneumoniaFields(); updateScores()">
                    <option value="ДН0">ДН0</option>
                    <option value="ДН1">ДН1</option>
                    <option value="ДН2">ДН2</option>
                    <option value="ДН3">ДН3</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>📊 CRB-65</label>
                <input type="text" id="crb65" value="0" inputmode="numeric" onchange="updateField('crb65', this.value)">
            </div>
            <div class="form-group">
                <label>📊 SMRT-CO (SMART-COP)</label>
                <input type="text" id="smrtco" value="0" inputmode="numeric" onchange="updateField('smrtco', this.value)">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>🧪 Альбумин (г/л)</label>
                <input type="text" id="albuminInput" inputmode="numeric" placeholder="35" oninput="updateField('albumin', this.value); updateScores()">
            </div>
            <div class="form-group">
                <label>🧪 pH артериальной крови</label>
                <input type="text" id="phInput" inputmode="decimal" placeholder="7.40" oninput="updateField('ph', this.value); updateScores()">
            </div>
        </div>`;
    }
    if (diag.hasErysipelasFields) {
        html += `
        <div class="form-row">
            <div class="form-group"><label>🔄 Характер</label><select id="erysipelasType" onchange="updateField('erysipelasType', this.value)"><option value="Первичная">Первичная</option><option value="Повторная">Повторная</option><option value="Рецидивирующая">Рецидивирующая</option></select></div>
            <div class="form-group"><label>📍 Сторона</label><select id="erysipelasSide" onchange="updateField('erysipelasSide', this.value)"><option value="правой">Правая</option><option value="левой">Левая</option></select></div>
            <div class="form-group"><label>📝 Часть тела</label><input type="text" id="erysipelasPart" placeholder="голень, лицо..." onchange="updateField('erysipelasPart', this.value)"></div>
            <div class="form-group"><label>🎨 Форма</label><select id="erysipelasForm" onchange="updateField('erysipelasForm', this.value); updateDynamicBlock()"><option value="эритематозная">Эритематозная</option><option value="буллезная">Буллезная</option><option value="геморрагическая">Геморрагическая</option></select></div>
        </div>`;
    }
    if (diag.hasHerpesFields) {
        html += `
        <div class="form-row">
            <div class="form-group"><label>📍 Сторона</label><select id="herpesSide" onchange="updateField('herpesSide', this.value)"><option value="правой">Правая</option><option value="левой">Левая</option></select></div>
            <div class="form-group"><label>📝 Локализация</label><input type="text" id="herpesLocation" placeholder="грудная клетка, лицо..." onchange="updateField('herpesLocation', this.value)"></div>
            <div class="form-group"><label>🔍 Характер высыпаний</label><select id="herpesRashType" onchange="updateField('herpesRashType', this.value); updateDynamicBlock()"><option value="везикулы">Везикулы с прозрачным содержимым</option><option value="пустулы">Везикулы с мутным содержимым + пустулы</option><option value="смешанные">Смешанные (везикулы, корки)</option></select></div>
        </div>`;
    }
    container.innerHTML = html;
    autoResizeAll(container);
}

// ========== КЛЮЧЕВАЯ ФУНКЦИЯ: ОБЪЕКТИВНЫЙ СТАТУС ==========
function updateDynamicBlock() {
    const diag = state.selectedDiagnosis;
    const container = document.getElementById('objectiveContent');
    if (!diag) {
        container.innerHTML = '<p style="color:var(--text-secondary);">Выберите диагноз</p>';
        return;
    }

    const allObjFields = ['skin','edema','mucous','subcutFat','lymphNodes','musculoskeletal','respiratory','cardiovascular','abdomen','spleen','stool','peritoneal','rectal','urinary','urination','meningeal'];
    const labelMap = {
        skin:'Оценка состояния кожных покровов', edema:'Отеки', mucous:'Оценка состояния видимых слизистых оболочек',
        subcutFat:'Состояние подкожно-жировой клетчатки', lymphNodes:'Результаты пальпации лимфатических узлов',
        musculoskeletal:'Оценка костно-мышечной системы', respiratory:'Результаты аускультации легких',
        cardiovascular:'Результаты перкуссии и аускультации сердца', abdomen:'Результаты пальпации органов брюшной полости с определением размеров печени и селезенки (перкуторно и пальпаторно в сантиметрах из-под края реберной дуги)',
        spleen:'Селезенка', stool:'Оценка характера стула и кратности дефекации',
        peritoneal:'Наличие симптомов раздражения брюшины', rectal:'Результаты пальцевого ректального исследования',
        urinary:'Результаты обследования мочеполовой системы', urination:'Оценка характера мочеиспускания',
        meningeal:'Наличие менингеальных симптомов'
    };

    let templates = { ...CONFIG.normalTemplates };

    if (diag.statusTemplates) {
        for (const [k, v] of Object.entries(diag.statusTemplates)) {
            templates[k] = v;
        }
    }

    if (state.chronicExpanded.some(ch => ch.key === 'ГБ')) {
        templates.cardiovascular = 'Тоны сердца ясные, ритмичные. Пульс ритмичный, удовлетворительного наполнения.';
    }
    if (state.chronicExpanded.some(ch => ch.key === 'СД')) {
        templates.skin = 'Кожные покровы обычной окраски, суховаты.';
    }

    const obesityEntry = state.chronicExpanded.find(c => c.key === 'Ожирение');
    const preg = state.chronicExpanded.find(c => c.key === 'бер');
    const isOKI = diag.type === 'oki';

    if (obesityEntry) {
        templates.subcutFat = `Подкожно-жировая клетчатка развита избыточно (ИМТ ${obesityEntry.fields.bmi || ''}).`;
        if (!isOKI) {
            const deg = obesityEntry.fields.degree || 'I';
            if (deg === 'I') {
                templates.abdomen = 'Живот увеличен за счет избыточно развитой подкожной жировой клетчатки, не вздут, участвует в акте дыхания, при пальпации мягкий, безболезненный. Печень не выступает из-под края реберной дуги, край печени эластичный, безболезненный.';
            } else {
                templates.abdomen = 'Живот увеличен за счет избыточно развитой подкожной жировой клетчатки, не вздут, участвует в акте дыхания, при пальпации мягкий, безболезненный. Печень не пальпируется в виду избыточно развитой подкожной жировой клетчатки.';
            }
        }
    }

    if (preg) {
        const weeks = getPregnancyWeeks(preg);
        if (weeks && (weeks.min > 16 || weeks.max > 16)) {
            templates.abdomen = 'Живот увеличен за счет беременности, не вздут, участвует в акте дыхания, при пальпации плотный за счет увеличенной матки, болезненный в эпигастрии. Матка в нормотонусе. Печень не выступает из-под края реберной дуги, край печени эластичный, безболезненный. Размеры печени по Курлову 10*9*8. Вертикальный размер по среднеключичной линии 9 см.';
        }
    }

    if (isOKI) {
        if (preg && getPregnancyWeeks(preg)?.min > 16) {
            templates.abdomen = 'Живот увеличен за счет беременности, не вздут, участвует в акте дыхания, при пальпации плотный за счет увеличенной матки, болезненный в эпигастрии. Матка в нормотонусе. Печень не выступает из-под края реберной дуги, край печени эластичный, безболезненный. Размеры печени по Курлову 10*9*8. Вертикальный размер по среднеключичной линии 9 см.';
        } else if (obesityEntry) {
            const deg = obesityEntry.fields.degree || 'I';
            if (deg === 'I') {
                templates.abdomen = 'Живот увеличен за счет избыточно развитой подкожной жировой клетчатки, не вздут, участвует в акте дыхания, при пальпации мягкий, болезненный в эпигастрии и левой подвздошной области. Печень не выступает из-под края реберной дуги, край печени эластичный, безболезненный. Размеры печени по Курлову 10*9*8. Вертикальный размер по среднеключичной линии 9 см.';
            } else {
                templates.abdomen = 'Живот увеличен за счет избыточно развитой подкожной жировой клетчатки, не вздут, участвует в акте дыхания, при пальпации мягкий, болезненный в эпигастрии и левой подвздошной области. Печень не пальпируется в виду избыточно развитой подкожной жировой клетчатки.';
            }
        } else {
            templates.abdomen = diag.statusTemplates.abdomen || CONFIG.normalTemplates.abdomen;
        }
        templates.mucous = 'Носовое дыхание не затруднено. Видимые слизистые и склеры физиологической окраски. Миндалины за дужками, чистые от налетов. Язык подсушен, обложен белым налетом.';

        const dynamicsText = state.dynamicFields['dynamics'] || '';
        const stoolNumber = extractStoolNumberFromDynamics(dynamicsText);
        templates.stool = templates.stool?.replace('___', stoolNumber || '—') || CONFIG.normalTemplates.stool;

        const currentComplaints = state.dynamicFields['currentComplaints'] || '';
        if (/снижение диуреза|уменьшение диуреза/i.test(currentComplaints)) {
            templates.urination = 'Мочеиспускание, со слов свободное, произвольное, безболезненное. Моча обычной окраски. Диурез снижен до ___ мл в сутки.';
        } else {
            templates.urination = CONFIG.normalTemplates.urination;
        }
    }

    if (diag.type === 'tonsillitis') {
        templates.mucous = 'Зев ярко гиперемирован, отмечается зернистость задней стенки глотки. Миндалины за дужками, чистые от налетов.';
    }

    const priorityFields = new Set();
    if (diag.priorityFields) diag.priorityFields.forEach(f => priorityFields.add(f));
    if (isOKI) {
        priorityFields.delete('cardiovascular');
        const dehydGrade = state.dynamicFields['dehydrationGrade'];
        if (dehydGrade === 'II' || dehydGrade === 'III') {
            priorityFields.add('skin');
        }
    }

    let html = '';
    for (const f of allObjFields) {
        if (!state.dynamicFields['status_'+f]) state.dynamicFields['status_'+f] = templates[f] || '';
        const isPriority = priorityFields.has(f);
        html += `<div class="form-group ${isPriority ? 'priority-field' : ''}">
            <label>${isPriority ? '⭐ ' : ''}${labelMap[f]}</label>
            <textarea id="status_${f}" oninput="updateField('status_${f}', this.value); autoResize(this);">${state.dynamicFields['status_'+f]}</textarea>
        </div>`;
    }
    html += `<div class="form-group">
        <label>Иные сведения (при наличии), локальный статус</label>
        <textarea id="status_localStatus" oninput="updateField('status_localStatus', this.value); autoResize(this);">${state.dynamicFields['status_localStatus'] || CONFIG.normalTemplates.localStatus}</textarea>
    </div>`;

    container.innerHTML = html;
    autoResizeAll(container);
    updatePreview();
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function updatePneumoniaFields() {
    const diag = state.selectedDiagnosis;
    if (!diag || diag.type !== 'pneumonia') return;
    const side = document.getElementById('pneumoniaSide')?.value || 'правосторонняя';
    const dn = document.getElementById('dnGrade')?.value || 'ДН0';
    let main = `(J18.9) Внебольничная, ${side} пневмония, неуточненной этиологии, нетяжелое течение ${dn}`;
    document.getElementById('mainDisease').value = main;
    updateField('mainDisease', main);
    let severityReason = 'интоксикацией, респираторными явлениями, катаральным синдромом';
    if (dn !== 'ДН0') severityReason += `, ОДН ${dn.replace('ДН','')} ст.`;
    updateField('severityReason', severityReason);
    updateDynamicBlock();
    checkFLG();
    updateScores();
}

function autoResizeAll(container) {
    container.querySelectorAll('textarea').forEach(ta => autoResize(ta));
}

// ========== ОБЩИЕ ФУНКЦИИ ОБНОВЛЕНИЯ ПОЛЕЙ ==========
function updateField(id, val) {
    state.dynamicFields[id] = val;
    if (id === 'currentComplaints') {
        updateDynamicBlock();
        renderSymptomButtons();
        updateSymptomHints();
        checkDiagnosisTriggers();
    }
    if (id === 'dehydrationGrade' || id === 'erysipelasForm' || id === 'herpesRashType') {
        updateDynamicBlock();
    }
    updatePreview();
}

function processAntibiotics(selfMedsText) {
    const antibioticsField = document.getElementById('antibioticsField');
    if (!antibioticsField) return;
    const words = selfMedsText.split(/[,;\s]+/).filter(w => w.length > 2);
    const existingText = antibioticsField.value;
    let added = false;
    for (const word of words) {
        const match = KNOWN_ANTIBIOTICS.find(ab => ab.toLowerCase() === word.toLowerCase());
        if (match && !existingText.includes(match)) {
            const line = `${match} (дата начала: ___, дата окончания: ___)`;
            antibioticsField.value = existingText.trim() ? existingText + '\n' + line : line;
            added = true;
        }
    }
    if (added) updateField('antibiotics', antibioticsField.value);
}

// ========== ХРОНИЧЕСКИЕ ЗАБОЛЕВАНИЯ ==========
function parseChronic() {
    const inputText = document.getElementById('chronicInput').value;
    const items = inputText.split(',').map(s => s.trim()).filter(Boolean);
    const hadAutoObesity = state.chronicExpanded.some(c => c.key === 'Ожирение' && c._auto);
    const userEnteredObesity = items.some(item => item.toUpperCase() === 'ОЖИРЕНИЕ' || item === 'Ожирение');
    let autoObesityEntry = null;
    if (hadAutoObesity && !userEnteredObesity) autoObesityEntry = state.chronicExpanded.find(c => c.key === 'Ожирение' && c._auto);
    const newChronic = [];
    for (let item of items) {
        const pm = item.match(/^бер\s*(.+)$/i);
        if (pm) { newChronic.push({ key:'бер', base:'Беременность', fields:{ weeks: pm[1].trim() } }); continue; }
        const upper = item.toUpperCase();
        let cfg = CONFIG.chronicMap[item] || CONFIG.chronicMap[upper];
        let foundKey = item;
        if (!cfg) { const converted = convertLayout(item).toUpperCase(); cfg = CONFIG.chronicMap[converted]; if (cfg) foundKey = converted; }
        if (!cfg && (upper==='СД'||item==='СД')) cfg = CONFIG.chronicMap['СД'];
        if (!cfg && (upper==='ГБ'||item==='ГБ')) cfg = CONFIG.chronicMap['ГБ'];
        if (!cfg && (upper==='АИТ'||item==='АИТ')) cfg = CONFIG.chronicMap['АИТ'];
        if (!cfg && (upper==='ОЖИРЕНИЕ'||item==='Ожирение')) cfg = CONFIG.chronicMap['Ожирение'];
        if (cfg) {
            const entry = { key: foundKey || item, base: cfg.base, fields: {} };
            if (cfg.fields) for (const f of cfg.fields) entry.fields[f.id] = f.defaultValue || '';
            newChronic.push(entry);
        } else newChronic.push({ key:item, base:item, fields:{} });
    }
    if (autoObesityEntry) newChronic.push(autoObesityEntry);
    state.chronicExpanded = newChronic;
    renderChronicTags();
    updateConcomitantAndMeds();
    updateDynamicBlock();
    updateScores();
}

function renderChronicTags() {
    document.getElementById('chronicTags').innerHTML = state.chronicExpanded.map((c, idx) => {
        const cfg = CONFIG.chronicMap[c.key] || CONFIG.chronicMap[c.key.toUpperCase()];
        let fieldsHtml = '';
        if (cfg && cfg.fields && cfg.fields.length) {
            fieldsHtml = cfg.fields.map(f => {
                const val = c.fields[f.id] !== undefined ? c.fields[f.id] : '';
                if (f.type === 'select') return `<select onchange="updateChronicField(${idx},'${f.id}',this.value)" style="background:var(--input-bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px;font-size:0.8em;margin-left:6px;">${(f.options||[]).map(o => `<option value="${o}" ${val===o?'selected':''}>${o||'—'}</option>`).join('')}</select>`;
                else return `<input type="${f.type}" value="${val}" placeholder="${f.placeholder||''}" onchange="updateChronicField(${idx},'${f.id}',this.value)" style="background:var(--input-bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px;width:110px;font-size:0.8em;margin-left:6px;">`;
            }).join('');
        }
        return `<span class="tag">${c.base}${fieldsHtml} <span onclick="removeChronic(${idx})" style="cursor:pointer;margin-left:4px;">×</span></span>`;
    }).join('');
}

function updateChronicField(idx, id, val) {
    if (state.chronicExpanded[idx]) {
        state.chronicExpanded[idx].fields[id] = val;
        updateConcomitantAndMeds();
        updateDynamicBlock();
        updateScores();
    }
}

function removeChronic(idx) {
    state.chronicExpanded.splice(idx, 1);
    renderChronicTags();
    updateConcomitantAndMeds();
    updateDynamicBlock();
    updateScores();
}

function updateConcomitantAndMeds() {
    const concomitantField = document.getElementById('concomitant');
    if (concomitantField) {
        concomitantField.value = state.chronicExpanded.map(c => formatChronicItem(c, false)).join('\n');
        updateField('concomitant', concomitantField.value);
    }
    const medsList = [];
    state.chronicExpanded.forEach(c => { if (c.fields && c.fields.meds) medsList.push(c.fields.meds); });
    const prescriptionsField = document.getElementById('prescriptions');
    if (prescriptionsField) {
        const medsText = medsList.filter(Boolean).join(', ');
        if (medsText && !prescriptionsField.value.includes(medsText)) {
            prescriptionsField.value = prescriptionsField.value ? prescriptionsField.value + '\n' + medsText : medsText;
            updateField('prescriptions', prescriptionsField.value);
        }
    }
}

function formatChronicItem(item, includeMeds = false) {
    let r = item.base;
    if (item.fields) {
        const details = [];
        if (item.base === 'Гипертоническая болезнь') {
            if (item.fields.stage) r += `, ${item.fields.stage} стадия`;
            if (includeMeds && item.fields.meds) details.push(`принимает: ${item.fields.meds}`);
            if (includeMeds && item.fields.usualBP) details.push(`привычное АД ${item.fields.usualBP}`);
        } else if (item.base === 'Сахарный диабет') {
            r = `Сахарный диабет ${item.fields.type || 'II типа'}`;
            if (includeMeds && item.fields.meds) details.push(`применяет: ${item.fields.meds}`);
        } else if (item.base === 'Аутоиммунный тиреоидит') {
            if (item.fields.condition) r += `: ${item.fields.condition}`;
            if (includeMeds && item.fields.meds) details.push(`принимает: ${item.fields.meds}`);
        } else if (item.base === 'Беременность') {
            r = `Беременность ${item.fields.weeks || '?'} недель`;
        } else if (item.base === 'Ожирение') {
            if (item.fields.degree) r += ` ${item.fields.degree} ст`;
            if (includeMeds && item.fields.bmi) details.push(`ИМТ ${item.fields.bmi}`);
        }
        if (includeMeds && details.length) r += ` (${details.join(', ')})`;
    }
    return r;
}

// ========== ШКАЛЫ ==========
function calculateCRB65() {
    let score = 0;
    const glasgow = parseInt(state.dynamicFields['glasgow']) || 15;
    if (glasgow < 15) score++;
    const rr = parseInt(document.getElementById('rrInput').value) || 0;
    if (rr >= 30) score++;
    const adValue = document.getElementById('adInput').value.trim();
    if (adValue && adValue.includes('/')) {
        const [sys, dia] = adValue.split('/').map(Number);
        if (!isNaN(sys) && !isNaN(dia) && (sys < 90 || dia <= 60)) score++;
    }
    if (state.patientAge !== null && state.patientAge >= 65) score++;
    return score;
}

function calculateSMARTCOP() {
    let score = 0;
    const age = state.patientAge;
    const adValue = document.getElementById('adInput').value.trim();
    if (adValue && adValue.includes('/')) {
        const [sys] = adValue.split('/').map(Number);
        if (!isNaN(sys) && sys < 90) score += 2;
    }
    const side = document.getElementById('pneumoniaSide')?.value || '';
    if (side === 'полисегментарная' || side === 'двусторонняя') score += 1;
    const albumin = parseFloat(state.dynamicFields['albumin']) || 0;
    if (albumin > 0 && albumin < 35) score += 1;
    const rr = parseInt(document.getElementById('rrInput').value) || 0;
    if (age !== null) {
        if (age <= 50 && rr >= 25) score += 1;
        else if (age > 50 && rr >= 30) score += 1;
    } else { if (rr >= 25) score += 1; }
    const hr = parseInt(document.getElementById('hrInput')?.value) || parseInt(document.getElementById('pulseInput')?.value) || 0;
    if (hr >= 125) score += 1;
    const glasgow = parseInt(state.dynamicFields['glasgow']) || 15;
    if (glasgow < 15) score += 1;
    const spo2 = parseFloat(document.getElementById('spo2Input').value) || 100;
    if (age !== null) {
        if (age <= 50 && spo2 < 94) score += 2;
        else if (age > 50 && spo2 < 90) score += 2;
    } else { if (spo2 < 94) score += 2; }
    const ph = parseFloat(state.dynamicFields['ph']) || 7.4;
    if (ph > 0 && ph < 7.35) score += 2;
    return score;
}

function updateScores() {
    if (!state.selectedDiagnosis || !state.selectedDiagnosis.hasPneumoniaFields) return;
    const crbField = document.getElementById('crb65');
    const smrtField = document.getElementById('smrtco');
    if (crbField) {
        crbField.value = calculateCRB65();
        updateField('crb65', crbField.value);
    }
    if (smrtField) {
        smrtField.value = calculateSMARTCOP();
        updateField('smrtco', smrtField.value);
    }
}

// ========== УМНЫЙ ВВОД ТЕМПЕРАТУРЫ, АД, ДАТЫ ==========
function allowTempInput() { const el = document.getElementById('tempInput'); el.value = el.value.replace(/[^0-9.,]/g, ''); }
function formatTemperature() {
    const el = document.getElementById('tempInput');
    let val = el.value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (!val) return;
    let num = parseFloat(val);
    if (isNaN(num)) return;
    if (!val.includes('.')) {
        if (val.length === 3) num = parseFloat(val.slice(0,2)+'.'+val.slice(2));
        else if (val.length === 2) num = parseFloat(val);
    }
    if (num < 30 || num > 45) { el.value = ''; return; }
    el.value = num.toFixed(1);
    checkVitals(); updateScores(); updatePreview();
}
function allowBPInput() { const el = document.getElementById('adInput'); el.value = el.value.replace(/[^0-9/, ]/g, ''); }
function formatBloodPressure() {
    const el = document.getElementById('adInput');
    let val = el.value.replace(/\s+/g, '').replace(',', '/').replace(/[^0-9/]/g, '');
    if (!val.includes('/')) {
        if (val.length === 4) val = val.slice(0,2)+'/'+val.slice(2);
        else if (val.length === 5) val = val.slice(0,3)+'/'+val.slice(3);
        else if (val.length === 6) val = val.slice(0,3)+'/'+val.slice(3);
    }
    el.value = val;
    checkVitals(); updateScores(); updatePreview();
}

function parseBirthDate(raw) {
    if (!raw) return;
    raw = raw.trim().replace(/\s+/g, '');
    let d, m, y;
    if (raw.includes('.')) {
        const parts = raw.split('.');
        if (parts.length === 3) { d = parts[0]; m = parts[1]; y = parts[2]; }
    } else if (raw.includes(',')) {
        const parts = raw.split(',');
        if (parts.length === 3) { d = parts[0]; m = parts[1]; y = parts[2]; }
    } else if (raw.includes('/')) {
        const parts = raw.split('/');
        if (parts.length === 3) { d = parts[0]; m = parts[1]; y = parts[2]; }
    } else if (raw.length === 8) {
        d = raw.slice(0,2); m = raw.slice(2,4); y = raw.slice(4,8);
    }
    if (d && m && y) {
        if (y.length === 2) y = '20' + y;
        const date = new Date(`${y}-${m}-${d}`);
        if (!isNaN(date.getTime())) {
            state.birthDate = date;
            document.getElementById('birthDateInput').value = `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`;
            updateAge();
        }
    }
}

function updateAge() {
    if (!state.birthDate) return;
    const today = new Date();
    let age = today.getFullYear() - state.birthDate.getFullYear();
    const m = today.getMonth() - state.birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < state.birthDate.getDate())) age--;
    state.patientAge = age;
    updateScores();
    updatePreview();
}

// ========== СКАНЕР QR ==========
function updatePatientId() {
    const id = document.getElementById('patientIdInput').value.trim();
    state.patientId = id || null;
    document.getElementById('patientIdDisplay').innerHTML = id ? `Код: ${id}` : '';
    updatePreview();
}
function startQRScanner() {
    const modal = document.getElementById('scannerModal');
    const video = document.getElementById('scannerVideo');
    modal.style.display = 'flex';
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            video.srcObject = stream;
            state.scannerStream = stream;
            video.play();
            requestAnimationFrame(scanFrame);
        })
        .catch(err => { alert('Не удалось получить доступ к камере: ' + err); stopQRScanner(); });
    } else { alert('Ваш браузер не поддерживает доступ к камере.'); stopQRScanner(); }
}
function stopQRScanner() {
    const modal = document.getElementById('scannerModal');
    const video = document.getElementById('scannerVideo');
    modal.style.display = 'none';
    if (state.scannerStream) { state.scannerStream.getTracks().forEach(t => t.stop()); state.scannerStream = null; }
    video.srcObject = null;
}
function scanFrame() {
    const video = document.getElementById('scannerVideo');
    const modal = document.getElementById('scannerModal');
    if (!modal || modal.style.display === 'none' || !state.scannerStream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code) { document.getElementById('patientIdInput').value = code.data; updatePatientId(); stopQRScanner(); return; }
    }
    requestAnimationFrame(scanFrame);
}

// ========== ПРОЧЕЕ ==========
function addHospitalBasisTemplate() {
    const select = document.getElementById('hospitalBasisSelect');
    const textarea = document.getElementById('hospitalBasis');
    const value = select.value;
    if (!value) return;
    let text = value;
    const today = new Date().toLocaleDateString('ru-RU');
    text = text.replace('(дата сегодня)', today);
    let current = textarea.value.trim();
    if (current) current += '\n';
    textarea.value = current + text;
    updateField('hospitalBasis', textarea.value);
    autoResize(textarea);
    updatePreview();
    select.value = '';
}
function addTransportTemplate() {
    const select = document.getElementById('transportSelect');
    const textarea = document.getElementById('hospitalBasis');
    const value = select.value;
    if (!value) return;
    let current = textarea.value.trim();
    if (current && !current.endsWith('.')) current += '. ';
    textarea.value = current + value;
    updateField('hospitalBasis', textarea.value);
    autoResize(textarea);
    updatePreview();
    select.value = '';
}
function addInterventionTemplate() {
    const select = document.getElementById('interventionTemplate');
    const textarea = document.getElementById('interventions');
    const templateKey = select.value;
    if (!templateKey) return;
    const templateText = CONFIG.interventionTemplates[templateKey];
    if (!templateText) return;
    let current = textarea.value.trim();
    if (current) {
        const lastChar = current.slice(-1);
        if (lastChar !== ';' && lastChar !== '.') current += '; ';
        else current += ' ';
    }
    textarea.value = current + templateText;
    updateField('interventions', textarea.value);
    autoResize(textarea);
    updatePreview();
    select.value = '';
}
function setupABTSelection() {
    const treatField = document.getElementById('treatmentPlan');
    const dropdown = document.getElementById('abtDropdown');
    if (!treatField || !dropdown) return;
    treatField.addEventListener('click', function(e) {
        const diag = state.selectedDiagnosis;
        if (!diag || diag.type !== 'oki' || !diag.abtOptions) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = diag.abtOptions.map(opt => `<li>${opt}</li>`).join('');
        dropdown.style.display = 'block';
        e.stopPropagation();
    });
    dropdown.addEventListener('mousedown', function(e) {
        const li = e.target.closest('li');
        if (!li) return;
        const selected = li.textContent;
        let currentText = treatField.value;
        const regex = /антибактериальная терапия[^.]*/i;
        if (regex.test(currentText)) currentText = currentText.replace(regex, selected);
        else currentText = currentText.trim() + (currentText ? ', ' : '') + selected;
        treatField.value = currentText;
        updateField('treatmentPlan', currentText);
        autoResize(treatField);
        updatePreview();
        dropdown.style.display = 'none';
    });
    document.addEventListener('click', function(e) { if (!treatField.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none'; });
}
function setupMucousSelection() {
    const mucousField = document.getElementById('status_mucous');
    const dropdown = document.getElementById('mucousDropdown');
    if (!mucousField || !dropdown) return;
    document.addEventListener('click', function(e) {
        const target = e.target;
        if (target.id !== 'status_mucous') { if (!dropdown.contains(target)) dropdown.style.display = 'none'; return; }
        if (!target.value.includes('гиперемирован')) { dropdown.style.display = 'none'; return; }
        const rect = target.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
        dropdown.style.left = (rect.left + window.scrollX) + 'px';
        dropdown.style.width = rect.width + 'px';
        dropdown.innerHTML = `<li data-value="ярко гиперемирован">ярко гиперемирован</li><li data-value="умеренно гиперемирован">умеренно гиперемирован</li>`;
        dropdown.style.display = 'block';
        e.stopPropagation();
    });
    dropdown.addEventListener('mousedown', function(e) {
        const li = e.target.closest('li');
        if (!li) return;
        const newVal = li.dataset.value;
        const textarea = document.getElementById('status_mucous');
        if (textarea) {
            textarea.value = textarea.value.replace(/ярко гиперемирован|умеренно гиперемирован/gi, newVal);
            updateField('status_mucous', textarea.value);
            autoResize(textarea);
            updatePreview();
        }
        dropdown.style.display = 'none';
    });
    document.addEventListener('click', function(e) { if (!dropdown.contains(e.target) && e.target.id !== 'status_mucous') dropdown.style.display = 'none'; });
}

function autoResize(el) { if (!el) return; el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; }
document.addEventListener('input', function(e) { if (e.target.tagName === 'TEXTAREA') autoResize(e.target); });

// ========== ПРЕДПРОСМОТР ==========
function updatePreview() {
    const L = [];
    const diag = state.selectedDiagnosis;
    if (state.patientId) {
        L.push(`👤 Идентификатор пациента: ${state.patientId}`);
        if (state.patientAge !== null) L.push(`   Возраст: ${state.patientAge} лет`);
        L.push('');
    }
    L.push('═══════════════════════════════════');
    L.push('  ПЕРВИЧНЫЙ ОСМОТР');
    L.push('  врачом приемного отделения');
    L.push(`  ${new Date().toLocaleString('ru-RU')}`);
    L.push('═══════════════════════════════════\n');

    if (state.dynamicFields['currentComplaints']) {
        L.push(`📝 Жалобы:\n   ${state.dynamicFields['currentComplaints']}\n`);
    }
    if (diag) {
        let fd = diag.full;
        if (diag.code) fd = `(${diag.code}) ${fd}`;
        L.push(`🩺 Предварительный диагноз: ${fd}`);
        if (state.diagnosisConfirmed) L.push('   ✅ Диагноз подтверждён');
        L.push('');
    }
    if (state.dynamicFields['onsetDate']) {
        const onsetRaw = state.dynamicFields['onsetDate'];
        const parts = onsetRaw.split('-');
        const onsetFormatted = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : onsetRaw;
        let anamnesis = `Заболевание началось остро ${onsetFormatted}`;
        const firstDay = state.dynamicFields['firstDayComplaints'] || '';
        if (firstDay) anamnesis += `, когда появились жалобы на ${firstDay}.`;
        if (state.dynamicFields['selfMeds']) anamnesis += ` Самостоятельный прием: ${state.dynamicFields['selfMeds']}.`;
        if (state.dynamicFields['referralPlace']) anamnesis += ` Обращался: ${state.dynamicFields['referralPlace']}.`;
        if (state.dynamicFields['dynamics']) anamnesis += ` Динамика: ${state.dynamicFields['dynamics']}.`;
        L.push(`📅 Анамнез заболевания:\n   ${anamnesis}\n`);
    }
    if (state.dynamicFields['epidAnamnesis']) L.push(`🦠 Эпид.анамнез:\n   ${state.dynamicFields['epidAnamnesis']}\n`);

    L.push('🔬 Объективный статус:');
    const order = ['skin','edema','mucous','subcutFat','lymphNodes','musculoskeletal','respiratory','cardiovascular','abdomen','spleen','stool','peritoneal','rectal','urinary','urination','meningeal'];
    const labelMap = {
        skin:'Кожные покровы', edema:'Отеки', mucous:'Слизистые', subcutFat:'Подкожно-жировая клетчатка',
        lymphNodes:'Лимфоузлы', musculoskeletal:'Костно-мышечная система', respiratory:'Аускультация легких',
        cardiovascular:'Сердце', abdomen:'Живот', spleen:'Селезенка', stool:'Стул',
        peritoneal:'Симптомы раздражения брюшины', rectal:'Ректальное исследование',
        urinary:'Мочеполовая система', urination:'Мочеиспускание', meningeal:'Менингеальные симптомы'
    };
    for (const f of order) {
        const v = state.dynamicFields['status_'+f] || CONFIG.normalTemplates[f];
        L.push(`   ${labelMap[f]}: ${v}`);
    }
    L.push('');

    if (state.dynamicFields['mainDisease']) L.push(`🩺 Основное заболевание: ${state.dynamicFields['mainDisease']}`);
    if (state.dynamicFields['complications']) L.push(`⚠ Осложнения: ${state.dynamicFields['complications']}`);
    if (state.dynamicFields['externalCause']) L.push(`💥 Внешняя причина: ${state.dynamicFields['externalCause']}`);
    if (state.dynamicFields['concomitant']) L.push(`📎 Сопутствующие: ${state.dynamicFields['concomitant']}`);
    if (state.dynamicFields['additionalInfo']) L.push(`📝 Доп.сведения: ${state.dynamicFields['additionalInfo']}`);
    if (state.dynamicFields['diagnosisBasis']) L.push(`🔍 Обоснование диагноза: ${state.dynamicFields['diagnosisBasis']}`);
    if (state.dynamicFields['hospitalBasis']) L.push(`🏥 Обоснование госпитализации: ${state.dynamicFields['hospitalBasis']}`);
    if (state.dynamicFields['interventions']) L.push(`💉 Вмешательства: ${state.dynamicFields['interventions']}`);
    L.push('');

    if (state.dynamicFields['examPlan']) L.push(`План обследования:\n   ${state.dynamicFields['examPlan']}\n`);
    if (state.dynamicFields['treatmentPlan']) L.push(`План лечения:\n   ${state.dynamicFields['treatmentPlan']}\n`);
    if (state.dynamicFields['prescriptions']) L.push(`Назначения:\n   ${state.dynamicFields['prescriptions']}\n`);
    const fy = document.getElementById('flgYear')?.value, fm = document.getElementById('flgMonth')?.value;
    if (fy && fm) L.push(`🫁 Флюорография: ${fm}.${fy}`);
    L.push('═══════════════════════════════════');
    document.getElementById('previewBox').textContent = L.join('\n');
}

function fillNormal() {
    for (const [k, v] of Object.entries(CONFIG.normalTemplates)) {
        if (k === 'localStatus') continue;
        const el = document.getElementById('status_'+k);
        if (el && !el.value.trim()) {
            el.value = v;
            updateField('status_'+k, v);
        }
    }
    updatePreview();
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    state.dynamicFields['severity'] = 'Средней тяжести';
    const interventionsField = document.getElementById('interventions');
    if (interventionsField) {
        interventionsField.value = `осмотр, измерение АД, Экспресс Ag SARS Cov2 от ${new Date().toLocaleDateString('ru-RU')} - отрицательно`;
        updateField('interventions', interventionsField.value);
    }
    setupAutocomplete(document.getElementById('allergyDrug'), ALLERGY_DRUGS);
    setupAutocomplete(document.getElementById('selfMeds'), SELF_MEDS);
    setupAutocomplete(document.getElementById('antibioticsField'), KNOWN_ANTIBIOTICS);
    setupABTSelection();
    setupMucousSelection();
    renderSymptomButtons();
    updateUIAfterDiagnosis();
    updatePreview();
});
