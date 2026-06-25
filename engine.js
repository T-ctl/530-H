// engine.js — полная логика (исправленная)
// Подключается после config.js

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
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
                renderChronicTags(); updateDynamicBlock(); updateConcomitantAndMeds();
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
    if (inf.vener) {
        let t = inf.vener;
        if (inf.venerYear) t += ` ${inf.venerYear} год`;
        parts.push(t);
    }
    if (inf.glist) {
        let t = inf.glist;
        if (inf.glistYear) t += ` ${inf.glistYear} год`;
        parts.push(t);
    }
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

// ========== ДИАГНОЗ ==========
function parseDiagnosis() {
    const inp = document.getElementById('diagnosisInput').value.trim().toUpperCase();
    const sug = document.getElementById('diagnosisSuggestion');
    sug.style.display = 'none';
    if (!inp) { state.selectedDiagnosis = null; updateDynamicBlock(); return; }
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
    if (m.dynamicsTemplate && !state.dynamicFields['dynamics']) state.dynamicFields['dynamics'] = m.dynamicsTemplate;
    document.getElementById('diagnosisInput').value = m.name;
    document.getElementById('diagnosisSuggestion').style.display = 'none';
    document.getElementById('dehydrationFields').style.display = m.hasDehydration ? 'block' : 'none';
    document.getElementById('pneumoniaFields').style.display = m.hasPneumoniaFields ? 'block' : 'none';
    document.getElementById('erysipelasFields').style.display = m.hasErysipelasFields ? 'block' : 'none';
    document.getElementById('herpesFields').style.display = m.hasHerpesFields ? 'block' : 'none';
    if (m.hasErysipelasFields) updateLocalStatusTemplate();
    if (m.hasHerpesFields) updateLocalStatusTemplate();
    if (m.hasPneumoniaFields) { updatePneumoniaFields(); updateScores(); }
    const prescr = document.getElementById('prescriptions');
    if (prescr && !prescr.value.trim() && m.prescriptionsTemplate) {
        prescr.value = m.prescriptionsTemplate; state.dynamicFields['prescriptions'] = m.prescriptionsTemplate; autoResize(prescr);
    }
    const treat = document.getElementById('treatmentPlan');
    if (treat && !treat.value.trim() && m.treatmentPlanTemplate) {
        treat.value = m.treatmentPlanTemplate; state.dynamicFields['treatmentPlan'] = m.treatmentPlanTemplate; autoResize(treat);
    }
    const exam = document.getElementById('examPlan');
    if (exam && !exam.value.trim() && m.examPlanTemplate) {
        exam.value = m.examPlanTemplate; state.dynamicFields['examPlan'] = m.examPlanTemplate; autoResize(exam);
    }
    updateDynamicBlock(); updateMainDiseaseFromDiagnosis(); updatePreview(); checkFLG();
}

function updatePneumoniaFields() {
    const diag = state.selectedDiagnosis;
    if (!diag || diag.type !== 'pneumonia') return;
    const side = document.getElementById('pneumoniaSide')?.value || 'правосторонняя';
    const dn = document.getElementById('dnGrade')?.value || 'ДН0';
    let main = `(J18.9) Внебольничная, ${side} пневмония, неуточненной этиологии, нетяжелое течение ${dn}`;
    document.getElementById('mainDisease').value = main; state.dynamicFields['mainDisease'] = main; autoResize(document.getElementById('mainDisease'));
    let severityReason = diag.severityReasonTemplate;
    if (dn !== 'ДН0') { const degree = dn.replace('ДН', ''); severityReason += `, ОДН ${degree} ст.`; }
    const sevReason = document.getElementById('severityReasonField');
    if (sevReason) { sevReason.value = severityReason; state.dynamicFields['severityReason'] = severityReason; autoResize(sevReason); }
    let respiratory = '';
    if (side === 'правосторонняя') respiratory = 'Аускультативно дыхание жесткое, ослаблено в нижних отделах, больше справа, там же выслушиваются мелкопузырчатые и сухие хрипы. Определяется усиление голосового дрожания и перкуторного звука справа.';
    else if (side === 'левосторонняя') respiratory = 'Аускультативно дыхание жесткое, ослаблено в нижних отделах, больше слева, там же выслушиваются мелкопузырчатые и сухие хрипы. Определяется усиление голосового дрожания и перкуторного звука слева.';
    else if (side === 'полисегментарная') respiratory = 'Аускультативно дыхание жесткое, ослаблено в нескольких сегментах с обеих сторон, там же выслушиваются мелкопузырчатые и сухие хрипы. Определяется усиление голосового дрожания и перкуторного звука над поражёнными участками.';
    else respiratory = 'Аускультативно дыхание жесткое, ослаблено в нижних отделах с двух сторон, там же выслушиваются мелкопузырчатые и сухие хрипы. Определяется усиление голосового дрожания и перкуторного звука с двух сторон в нижних отделах.';
    const respField = document.getElementById('status_respiratory');
    if (respField) { respField.value = respiratory; state.dynamicFields['status_respiratory'] = respiratory; autoResize(respField); }
    const examPlan = document.getElementById('examPlan');
    const treatPlan = document.getElementById('treatmentPlan');
    if (diag.examPlanTemplate && examPlan) {
        examPlan.value = dn !== 'ДН0' ? diag.examPlanTemplateDN : diag.examPlanTemplate;
        state.dynamicFields['examPlan'] = examPlan.value; autoResize(examPlan);
    }
    if (diag.treatmentPlanTemplate && treatPlan) {
        treatPlan.value = dn !== 'ДН0' ? diag.treatmentPlanTemplateDN : diag.treatmentPlanTemplate;
        state.dynamicFields['treatmentPlan'] = treatPlan.value; autoResize(treatPlan);
    }
    checkFLG(); updatePreview();
}

function updateMainDiseaseFromDiagnosis() {
    const diag = state.selectedDiagnosis;
    const mainField = document.getElementById('mainDisease');
    if (!mainField || !diag) return;
    let full = diag.full;
    if (diag.code) full = `(${diag.code}) ${full}`;
    if (diag.type === 'pneumonia') return;
    else if (diag.hasErysipelasFields) {
        full = `(${diag.code}) ${document.getElementById('erysipelasType')?.value || 'Первичная'} рожа ${document.getElementById('erysipelasSide')?.value || 'правой'} ${document.getElementById('erysipelasPart')?.value || 'голени'}, ${document.getElementById('erysipelasForm')?.value || 'эритематозная'}`;
    } else if (diag.hasHerpesFields) {
        full = `(${diag.code}) Herpes zoster ${document.getElementById('herpesSide')?.value || 'правой'} ${document.getElementById('herpesLocation')?.value || 'половины тела'}, в зоне иннервации`;
    }
    mainField.value = full; state.dynamicFields['mainDisease'] = full; autoResize(mainField);
}

function updateLocalStatusTemplate() {
    const diag = state.selectedDiagnosis;
    if (!diag) return;
    if (diag.type === 'erysipelas') {
        const form = document.getElementById('erysipelasForm')?.value || 'эритематозная';
        const side = document.getElementById('erysipelasSide')?.value || 'правой';
        const part = document.getElementById('erysipelasPart')?.value || 'голени';
        let t = `на коже ${side} ${part} расположена зона яркой гиперемии с четкими неровными контурами. Поверхность горячая на ощупь, болезненная при пальпации.`;
        if (form === 'буллезная') t += ' На передне-боковой поверхности расположены единичные буллы с прозрачным содержимым.';
        if (form === 'геморрагическая') t += ' Отмечаются одиночные геморрагии на фоне гиперемии.';
        state.dynamicFields['status_localStatus'] = t;
        const el = document.getElementById('status_localStatus'); if (el) el.value = t;
        updatePreview();
    }
    if (diag.type === 'herpes') {
        const rash = document.getElementById('herpesRashType')?.value || 'везикулы';
        const side = document.getElementById('herpesSide')?.value || 'правой';
        const loc = document.getElementById('herpesLocation')?.value || 'половины грудной клетки';
        let t = `на коже ${side} ${loc}, в зоне иннервации, расположены множественные везикулярные элементы `;
        if (rash === 'везикулы') t += 'с прозрачным содержимым на гиперемированном основании. Отмечаются одиночные корки. Пустул нет.';
        else if (rash === 'пустулы') t += 'с мутным содержимым на гиперемированном основании. Отмечаются одиночные корки и пустулы.';
        else t += '(везикулы, корки, пустулы) на гиперемированном основании.';
        state.dynamicFields['status_localStatus'] = t;
        const el = document.getElementById('status_localStatus'); if (el) el.value = t;
        updatePreview();
    }
}

function addAllergy() {
    const d = document.getElementById('allergyDrug').value.trim();
    const r = document.getElementById('allergyReaction').value;
    if (!d || !r) return;
    state.allergies.push({ drug: d, reaction: r });
    document.getElementById('allergyDrug').value = '';
    document.getElementById('allergyReaction').value = '';
    renderAllergies(); updatePreview();
}

function removeAllergy(i) { state.allergies.splice(i, 1); renderAllergies(); updatePreview(); }

function renderAllergies() {
    document.getElementById('allergyList').innerHTML = state.allergies.map((a, i) =>
        `<span class="allergy-tag">${a.drug} (${a.reaction}) <span class="remove-allergy" onclick="removeAllergy(${i})">×</span></span>`
    ).join('');
}

// ========== ХРОНИЧЕСКИЕ ==========
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
        if (pm) { newChronic.push({ key: 'бер', base: 'Беременность', fields: { weeks: pm[1].trim() } }); continue; }
        const upper = item.toUpperCase();
        let cfg = CONFIG.chronicMap[item] || CONFIG.chronicMap[upper];
        let foundKey = item;
        if (!cfg) {
            const converted = convertLayout(item).toUpperCase();
            cfg = CONFIG.chronicMap[converted];
            if (cfg) foundKey = converted;
        }
        if (!cfg && (upper === 'СД' || item === 'СД')) cfg = CONFIG.chronicMap['СД'];
        if (!cfg && (upper === 'ГБ' || item === 'ГБ')) cfg = CONFIG.chronicMap['ГБ'];
        if (!cfg && (upper === 'АИТ' || item === 'АИТ')) cfg = CONFIG.chronicMap['АИТ'];
        if (!cfg && (upper === 'ОЖИРЕНИЕ' || item === 'Ожирение')) cfg = CONFIG.chronicMap['Ожирение'];
        if (cfg) {
            const entry = { key: foundKey || item, base: cfg.base, fields: {} };
            if (cfg.fields) for (const f of cfg.fields) entry.fields[f.id] = f.defaultValue || '';
            newChronic.push(entry);
        } else newChronic.push({ key: item, base: item, fields: {} });
    }
    if (autoObesityEntry) newChronic.push(autoObesityEntry);
    state.chronicExpanded = newChronic;
    renderChronicTags(); updateDynamicBlock(); updateConcomitantAndMeds(); updateScores();
}

function renderChronicTags() {
    document.getElementById('chronicTags').innerHTML = state.chronicExpanded.map((c, idx) => {
        const cfg = CONFIG.chronicMap[c.key] || CONFIG.chronicMap[c.key.toUpperCase()];
        let fieldsHtml = '';
        if (cfg && cfg.fields && cfg.fields.length) {
            fieldsHtml = cfg.fields.map(f => {
                const val = c.fields[f.id] !== undefined ? c.fields[f.id] : '';
                if (f.type === 'select') return `<select onchange="updateChronicField(${idx},'${f.id}',this.value)" style="background:var(--input-bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px;font-size:0.8em;margin-left:6px;">${(f.options || []).map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o || '—'}</option>`).join('')}</select>`;
                else return `<input type="${f.type}" value="${val}" placeholder="${f.placeholder || ''}" onchange="updateChronicField(${idx},'${f.id}',this.value)" style="background:var(--input-bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px;width:110px;font-size:0.8em;margin-left:6px;">`;
            }).join('');
        }
        return `<span class="tag">${c.base}${fieldsHtml} <span onclick="removeChronic(${idx})" style="cursor:pointer;margin-left:4px;">×</span></span>`;
    }).join('');
}

function updateChronicField(idx, id, val) {
    if (state.chronicExpanded[idx]) {
        state.chronicExpanded[idx].fields[id] = val;
        updateDynamicBlock(); updateConcomitantAndMeds(); updateScores();
    }
}

function removeChronic(idx) {
    state.chronicExpanded.splice(idx, 1);
    renderChronicTags(); updateDynamicBlock(); updateConcomitantAndMeds(); updateScores();
}

function formatChronicItem(item, includeMeds = false) {
    let r = item.base;
    if (item.fields) {
        const details = [];
        if (item.base === 'Гипертоническая болезнь') {
            if (item.fields.stage) r += `, ${item.fields.stage} стадия`;
            else r += `, стадия требует уточнения`;
            if (includeMeds && item.fields.meds) details.push(`принимает: ${item.fields.meds}`);
            if (includeMeds && item.fields.usualBP) details.push(`привычное АД ${item.fields.usualBP}`);
        } else if (item.base === 'Сахарный диабет') {
            r = `Сахарный диабет ${item.fields.type || 'II типа'}`;
            if (includeMeds && item.fields.meds) details.push(`применяет: ${item.fields.meds}`);
        } else if (item.base === 'Аутоиммунный тиреоидит') {
            if (item.fields.condition) r += `: ${item.fields.condition}`;
            if (includeMeds && item.fields.meds) details.push(`принимает: ${item.fields.meds}`);
        } else if (item.base === 'Беременность') {
            const weeks = item.fields.weeks || '?';
            r = `Беременность ${weeks} недель`;
        } else if (item.base === 'Ожирение') {
            if (item.fields.degree) r += ` ${item.fields.degree} ст`;
            if (includeMeds && item.fields.bmi) details.push(`ИМТ ${item.fields.bmi}`);
        }
        if (includeMeds && details.length) r += ` (${details.join(', ')})`;
    }
    return r;
}

function updateConcomitantAndMeds() {
    const concomitantField = document.getElementById('concomitant');
    if (concomitantField) {
        concomitantField.value = state.chronicExpanded.map(c => formatChronicItem(c, false)).join('\n');
        state.dynamicFields['concomitant'] = concomitantField.value;
        autoResize(concomitantField);
    }
    const medsList = [];
    state.chronicExpanded.forEach(c => { if (c.fields && c.fields.meds) medsList.push(c.fields.meds); });
    const prescriptionsField = document.getElementById('prescriptions');
    if (prescriptionsField) {
        const medsText = medsList.filter(Boolean).join(', ');
        if (medsText && !prescriptionsField.value.includes(medsText)) {
            prescriptionsField.value = prescriptionsField.value ? prescriptionsField.value + '\n' + medsText : medsText;
            state.dynamicFields['prescriptions'] = prescriptionsField.value;
            autoResize(prescriptionsField);
        }
    }
}

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
    state.dynamicFields['hospitalBasis'] = textarea.value;
    autoResize(textarea); updatePreview();
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
    state.dynamicFields['hospitalBasis'] = textarea.value;
    autoResize(textarea); updatePreview();
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
    state.dynamicFields['interventions'] = textarea.value;
    autoResize(textarea); updatePreview();
    select.value = '';
}

function cleanComplaintItem(item) {
    let trimmed = item.trim();
    if (trimmed.startsWith('на ')) trimmed = trimmed.substring(3).trim();
    if (trimmed.endsWith('.')) trimmed = trimmed.slice(0, -1).trim();
    return trimmed;
}

function extractStoolNumberFromDynamics(dynamicsText) {
    const match = dynamicsText.match(/(?:стул\s*(?:до\s*)?|кратность\s+стула\s*)\s*(\d+)/i);
    return match ? match[1] : null;
}

function buildTotalComplaints() {
    const firstDay = state.dynamicFields['complaints'] || '';
    const dynamicsText = state.dynamicFields['dynamics'] || '';
    let complaintsSet = new Set();
    const stoolNumberFromDynamics = extractStoolNumberFromDynamics(dynamicsText);
    firstDay.split(',').forEach(s => {
        let cleaned = cleanComplaintItem(s);
        if (!cleaned) return;
        if (stoolNumberFromDynamics && (cleaned.includes('стул') || cleaned.includes('кратность'))) {
            cleaned = cleaned.replace(/(\d+)\s*(раз[а]?)/i, `${stoolNumberFromDynamics} $2`);
        }
        complaintsSet.add(cleaned);
    });
    let processedDynamics = dynamicsText
        .replace(/;\s*\+/g, '\n+')
        .replace(/,\s*\+/g, '\n+')
        .replace(/;\s*\-/g, '\n-')
        .replace(/,\s*\-/g, '\n-');
    const lines = processedDynamics.split('\n').filter(Boolean);
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-')) {
            complaintsSet.delete(cleanComplaintItem(trimmed.substring(1)));
        } else if (trimmed.startsWith('+')) {
            let cleaned = cleanComplaintItem(trimmed.substring(1));
            if (!cleaned) continue;
            if (stoolNumberFromDynamics && /стул\s*\d+/.test(cleaned)) continue;
            complaintsSet.add(cleaned);
        }
    }
    return Array.from(complaintsSet).join(', ');
}

function buildAnamnesisMorbi() {
    const onsetRaw = state.dynamicFields['onsetDate'];
    const complaintsDay1Raw = state.dynamicFields['complaints'] || '';
    if (!onsetRaw || !complaintsDay1Raw) return '';
    const complaintsDay1Clean = complaintsDay1Raw.split(',').map(s => cleanComplaintItem(s)).filter(Boolean).join(', ');
    const parts = onsetRaw.split('-');
    const onsetFormatted = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : onsetRaw;
    let text = `Заболевание началось остро с ${onsetFormatted}, когда появились жалобы на ${complaintsDay1Clean}.`;
    const meds = state.dynamicFields['selfMeds'];
    if (meds) text += ` Самостоятельный прием: ${meds}.`;
    const onsetDate = new Date(onsetRaw + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const nextDay = new Date(onsetDate); nextDay.setDate(nextDay.getDate() + 1);
    if (nextDay <= today) {
        const fd = d => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
        const rangeStr = nextDay.getTime() === today.getTime() ? fd(nextDay) : `${fd(nextDay)}-${fd(today)}`;
        const totalComplaints = buildTotalComplaints();
        if (totalComplaints) text += ` ${rangeStr} жалобы на ${totalComplaints}.`;
    }
    const refPlace = state.dynamicFields['referralPlace'] || 'поликлинику';
    const refType = state.dynamicFields['referralType'] || 'дано направление';
    const effect = state.dynamicFields['selfEffect'] || '';
    const reason = effect === 'ухудшение' ? 'ухудшения' : 'отсутствия улучшения';
    if (refType === 'дано направление') text += ` Ввиду ${reason} отмечается обращение в ${refPlace}, дано направление в СКИБ.`;
    else if (refType === 'обратился(-ась) самостоятельно') text += ` Отмечается самостоятельное обращение в ${refPlace}.`;
    else if (refType === 'вызвал(а) СМП') text += ` Вызвал(а) СМП.`;
    const transport = state.dynamicFields['transportType'] || 'СМП';
    if (transport === 'общественный транспорт') text += ` Произведена транспортировка в СКИБ: общественный транспорт.`;
    else if (transport === 'родственниками на общественном транспорте') text += ` Доставлен(а) родственниками на общественном транспорте.`;
    else text += ` Произведена транспортировка бригадой СМП в СКИБ.`;
    return text;
}

function autoResize(el) { if (!el) return; el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; }
document.addEventListener('input', function(e) { if (e.target.tagName === 'TEXTAREA') autoResize(e.target); });

function handlePlaceholderPrompt(e) {
    const textarea = e.target;
    if (textarea.tagName !== 'TEXTAREA') return;
    const text = textarea.value;
    const idx = text.indexOf('___');
    if (idx === -1) return;
    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + 3 + 20);
    const context = text.substring(start, end);
    const userValue = prompt('Введите значение для замены «___»\nКонтекст: …' + context + '…');
    if (userValue !== null) {
        const newText = text.replace('___', userValue);
        textarea.value = newText;
        const fieldId = textarea.id;
        if (fieldId) state.dynamicFields[fieldId] = newText;
        autoResize(textarea);
        updatePreview();
    }
}
document.addEventListener('focusin', handlePlaceholderPrompt);

function updateDependentStatusFields() {
    const diag = state.selectedDiagnosis;
    if (!diag || diag.type !== 'oki') return;
    const dynamicsText = state.dynamicFields['dynamics'] || '';
    const allComplaints = (state.dynamicFields['complaints'] || '') + ' ' + dynamicsText;
    const stoolEl = document.getElementById('status_stool');
    if (stoolEl) {
        const stoolNumber = extractStoolNumberFromDynamics(dynamicsText);
        let stoolTemplate = CONFIG.normalTemplates.stool;
        if (diag.statusTemplates && diag.statusTemplates.stool) stoolTemplate = diag.statusTemplates.stool;
        stoolEl.value = stoolTemplate.replace('___', stoolNumber || '—');
        state.dynamicFields['status_stool'] = stoolEl.value;
    }
    const urinEl = document.getElementById('status_urination');
    if (urinEl) {
        let urinTemplate = CONFIG.normalTemplates.urination;
        if (diag.statusTemplates && diag.statusTemplates.urination) urinTemplate = diag.statusTemplates.urination;
        if (/снижение диуреза|уменьшение диуреза/i.test(allComplaints)) {
            const diurMatch = allComplaints.match(/диурез[а]?\s*(?:снижен|уменьшен)[а]?\s*(?:до)?\s*(\d+)/i);
            const amount = diurMatch && diurMatch[1] ? diurMatch[1] : '___';
            urinEl.value = `Мочеиспускание со слов свободное, произвольное, безболезненное. Моча обычной окраски. Диурез снижен до ${amount} мл в сутки.`;
        } else {
            urinEl.value = urinTemplate;
        }
        state.dynamicFields['status_urination'] = urinEl.value;
    }
    updatePreview();
}

function updateField(id, val) {
    state.dynamicFields[id] = val;
    if (id === 'complaints' || id === 'dynamics') { updateDependentStatusFields(); updatePreview(); }
    else if (id === 'selfMeds') { processAntibiotics(val); updatePreview(); }
    else updatePreview();
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
    if (added) { state.dynamicFields['antibiotics'] = antibioticsField.value; autoResize(antibioticsField); }
}

// ========== УМНЫЙ ВВОД ТЕМПЕРАТУРЫ И АД ==========
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
        if (val.length === 4) val = val.slice(0,2) + '/' + val.slice(2);
        else if (val.length === 5) val = val.slice(0,3) + '/' + val.slice(3);
        else if (val.length === 6) val = val.slice(0,3) + '/' + val.slice(3);
    }
    el.value = val;
    checkVitals(); updateScores(); updatePreview();
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
    const hr = parseInt(document.getElementById('pulseInput').value) || 0;
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
    if (crbField) { const newCrb = calculateCRB65(); crbField.value = newCrb; state.dynamicFields['crb65'] = newCrb; }
    if (smrtField) { const newSmrt = calculateSMARTCOP(); smrtField.value = newSmrt; state.dynamicFields['smrtco'] = newSmrt; }
    updatePreview();
}

function updateAge() {
    const birthValue = document.getElementById('birthDateInput').value;
    if (!birthValue) { state.patientAge = null; }
    else {
        const birth = new Date(birthValue);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        state.patientAge = age;
    }
    updateScores(); updatePreview();
}

// ========== СКАНЕР ==========
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

// ========== ВЫПАДАЮЩИЕ СПИСКИ ==========
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
        treatField.value = currentText; state.dynamicFields['treatmentPlan'] = currentText;
        autoResize(treatField); updatePreview(); dropdown.style.display = 'none';
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
        if (textarea) { textarea.value = textarea.value.replace(/ярко гиперемирован|умеренно гиперемирован/gi, newVal); state.dynamicFields['status_mucous'] = textarea.value; autoResize(textarea); updatePreview(); }
        dropdown.style.display = 'none';
    });
    document.addEventListener('click', function(e) { if (!dropdown.contains(e.target) && e.target.id !== 'status_mucous') dropdown.style.display = 'none'; });
}

// ========== ГЛАВНАЯ ФУНКЦИЯ ИНТЕРФЕЙСА ==========
function updateDynamicBlock() {
    const diag = state.selectedDiagnosis;
    const c = document.getElementById('dynamicContent');
    let h = '';
    h += `<div class="form-group"><label>📋 Жалобы первого дня</label><textarea id="complaintsField" oninput="updateField('complaints', this.value); autoResize(this);">${state.dynamicFields['complaints'] || diag?.complaintsTemplate || ''}</textarea></div>`;
    h += `<div class="form-row"><div class="form-group"><label>📅 Дата начала</label><input type="date" id="onsetDate" onchange="updateField('onsetDate', this.value); updatePreview();" value="${state.dynamicFields['onsetDate']||''}"></div><div class="form-group"><label>🔄 Характер</label><select id="onsetType" onchange="updateField('onsetType', this.value)"><option value="остро" ${state.dynamicFields['onsetType']==='остро'?'selected':''}>Остро</option><option value="постепенно" ${state.dynamicFields['onsetType']==='постепенно'?'selected':''}>Постепенно</option></select></div></div>`;
    h += `<div class="form-group"><label>💊 Принимаемые препараты самостоятельно</label><input type="text" id="selfMeds" placeholder="Начните вводить" oninput="updateField('selfMeds', this.value)" value="${state.dynamicFields['selfMeds']||''}"><div class="drug-hint">Введите минимум 2 символа для поиска</div></div>`;
    h += `<div class="form-row"><div class="form-group"><label>📉 Эффект</label><select id="selfEffect" onchange="updateField('selfEffect', this.value)"><option value="без эффекта" ${state.dynamicFields['selfEffect']==='без эффекта'?'selected':''}>Без эффекта</option><option value="ухудшение" ${state.dynamicFields['selfEffect']==='ухудшение'?'selected':''}>Ухудшение</option></select></div></div>`;
    const dynamicsVal = state.dynamicFields['dynamics'] || (diag?.dynamicsTemplate || '');
    h += `<div class="form-group"><label>📅 Динамика жалоб</label><textarea id="dynamicsField" oninput="updateField('dynamics', this.value); autoResize(this);">${dynamicsVal}</textarea></div>`;
    h += `<div class="form-row"><div class="form-group"><label>🏥 Куда обратился(-ась)</label><input type="text" id="referralPlace" oninput="updateField('referralPlace', this.value)" value="${state.dynamicFields['referralPlace']||'поликлинику'}"></div><div class="form-group"><label>📋 Тип обращения</label><select id="referralType" onchange="updateField('referralType', this.value)"><option value="дано направление" ${state.dynamicFields['referralType']==='дано направление'?'selected':''}>Дано направление</option><option value="обратился(-ась) самостоятельно" ${state.dynamicFields['referralType']==='обратился(-ась) самостоятельно'?'selected':''}>Самостоятельно</option><option value="вызвал(а) СМП" ${state.dynamicFields['referralType']==='вызвал(а) СМП'?'selected':''}>Вызвал(а) СМП</option></select></div></div>`;
    h += `<div class="form-row"><div class="form-group"><label>🚑 Доставлен(а)</label><select id="transportType" onchange="updateField('transportType', this.value)"><option value="СМП" ${state.dynamicFields['transportType']==='СМП'?'selected':''}>СМП</option><option value="родственниками на общественном транспорте" ${state.dynamicFields['transportType']==='родственниками на общественном транспорте'?'selected':''}>Родственниками на общ. транспорте</option><option value="общественный транспорт" ${state.dynamicFields['transportType']==='общественный транспорт'?'selected':''}>Общественный транспорт</option></select></div></div>`;
    if (diag && diag.epidTemplate) h += `<div class="form-group" style="border-left:3px solid var(--accent);padding-left:10px;"><label>🦠 Эпид.анамнез</label><textarea id="epidField" oninput="updateField('epidAnamnesis', this.value); autoResize(this);">${state.dynamicFields['epidAnamnesis'] || diag.epidTemplate || ''}</textarea></div>`;
    if (diag && diag.type === 'pneumonia') {
        h += `<div class="form-row"><div class="form-group"><label>🧪 Альбумин (г/л)</label><input type="number" id="albuminInput" step="1" placeholder="35" value="${state.dynamicFields['albumin']||''}" oninput="updateField('albumin', this.value); updateScores()"></div><div class="form-group"><label>🧪 pH артериальной крови</label><input type="number" id="phInput" step="0.01" placeholder="7.40" value="${state.dynamicFields['ph']||''}" oninput="updateField('ph', this.value); updateScores()"></div></div>`;
    }
    h += `<div class="form-group"><label>📖 Анамнез жизни</label><textarea id="anamnesisVitaeField" oninput="updateField('anamnesisVitae', this.value); autoResize(this);">${state.dynamicFields['anamnesisVitae']||''}</textarea></div>`;
    h += `<div class="form-group"><label>🦴 Травмы, операции</label><textarea id="traumaField" oninput="updateField('trauma', this.value); autoResize(this);">${state.dynamicFields['trauma']||'отрицает'}</textarea></div>`;
    h += `<div class="form-group"><label>🏥 Находился ли в последние 3 мес на лечении в других ЛПУ</label><textarea id="hospital3mField" oninput="updateField('hospital3m', this.value); autoResize(this);">${state.dynamicFields['hospital3m']||'отрицает'}</textarea></div>`;
    h += `<div class="form-group"><label>🩸 Трансфузии (год, осложнения, реакции)</label><textarea id="transfusionField" oninput="updateField('transfusion', this.value); autoResize(this);">${state.dynamicFields['transfusion']||'отрицает'}</textarea></div>`;
    h += `<div class="form-group"><label>💊 Применяемые антибиотики</label><textarea id="antibioticsField" oninput="updateField('antibiotics', this.value); autoResize(this);">${state.dynamicFields['antibiotics']||''}</textarea></div>`;
    h += `<div class="form-row"><div class="form-group"><label>📊 Тяжесть состояния пациента</label><select id="severityField" onchange="updateField('severity', this.value)"><option value="Удовлетворительное" ${state.dynamicFields['severity']==='Удовлетворительное'?'selected':''}>Удовлетворительное</option><option value="Средней тяжести" ${state.dynamicFields['severity']==='Средней тяжести'?'selected':''}>Средней тяжести</option><option value="Тяжелое" ${state.dynamicFields['severity']==='Тяжелое'?'selected':''}>Тяжелое</option></select></div><div class="form-group"><label>🧠 Уровень сознания по шкале Глазго</label><input type="number" id="glasgowField" value="${state.dynamicFields['glasgow']||'15'}" onchange="updateField('glasgow', this.value); updateScores()" min="3" max="15"></div></div>`;
    if (diag && diag.severityReasonTemplate) h += `<div class="form-group"><label>📝 Тяжесть состояния обусловлена</label><textarea id="severityReasonField" oninput="updateField('severityReason', this.value); autoResize(this);">${state.dynamicFields['severityReason'] || diag.severityReasonTemplate || ''}</textarea></div>`;

    h += `<div class="section-divider"></div><div class="panel-title">🔬 Объективный статус (Приказ 530н)</div>`;
    const allObjFields = ['skin','edema','mucous','subcutFat','lymphNodes','musculoskeletal','respiratory','cardiovascular','abdomen','spleen','stool','peritoneal','rectal','urinary','urination','meningeal'];
    const labelMap = { skin:'Кожные покровы', edema:'Отеки', mucous:'Слизистые', subcutFat:'Подкожно-жировая клетчатка', lymphNodes:'Лимфоузлы', musculoskeletal:'Костно-мышечная система', respiratory:'Аускультация легких', cardiovascular:'Сердце', abdomen:'Живот', spleen:'Селезенка', stool:'Стул', peritoneal:'Симптомы раздражения брюшины', rectal:'Ректальное исследование', urinary:'Мочеполовая система', urination:'Мочеиспускание', meningeal:'Менингеальные симптомы' };
    let templates = { ...CONFIG.normalTemplates };
    if (diag && diag.statusTemplates) for (const [k, v] of Object.entries(diag.statusTemplates)) templates[k] = v;
    if (state.chronicExpanded.some(ch => ch.key === 'ГБ')) templates.cardiovascular = 'Тоны сердца ясные, ритмичные. Пульс ритмичный, удовлетворительного наполнения.';
    if (state.chronicExpanded.some(ch => ch.key === 'СД')) templates.skin = 'Кожные покровы обычной окраски, суховаты.';
    const obesityEntry = state.chronicExpanded.find(c => c.key === 'Ожирение');
    const preg = state.chronicExpanded.find(c => c.key === 'бер');
    const isOKI = diag && diag.type === 'oki';
    if (isOKI) {
        if (preg && getPregnancyWeeks(preg)?.min > 16) templates.abdomen = 'Живот увеличен за счет беременности, не вздут, участвует в акте дыхания, при пальпации плотный за счет увеличенной матки, болезненный в эпигастрии. Матка в нормотонусе. Печень не выступает из-под края реберной дуги, край печени эластичный, безболезненный. Размеры печени по Курлову 10*9*8. Вертикальный размер по среднеключичной линии 9 см.';
        else if (obesityEntry) {
            const deg = obesityEntry.fields.degree || 'I';
            if (deg === 'I') templates.abdomen = 'Живот увеличен за счет избыточно развитой подкожной жировой клетчатки, не вздут, участвует в акте дыхания, при пальпации мягкий, болезненный в эпигастрии и левой подвздошной области. Печень не выступает из-под края реберной дуги, край печени эластичный, безболезненный. Размеры печени по Курлову 10*9*8. Вертикальный размер по среднеключичной линии 9 см.';
            else templates.abdomen = 'Живот увеличен за счет избыточно развитой подкожной жировой клетчатки, не вздут, участвует в акте дыхания, при пальпации мягкий, болезненный в эпигастрии и левой подвздошной области. Печень не пальпируется в виду избыточно развитой подкожной жировой клетчатки.';
        } else templates.abdomen = diag.statusTemplates.abdomen;
        templates.mucous = diag.statusTemplates.mucous;
    } else {
        if (preg && getPregnancyWeeks(preg)?.min > 16) templates.abdomen = 'Живот увеличен за счет беременности, не вздут, участвует в акте дыхания, при пальпации плотный за счет увеличенной матки, матка в нормотонусе. Печень не выступает из-под края реберной дуги, край печени эластичный, безболезненный.';
        else if (obesityEntry) {
            const deg = obesityEntry.fields.degree || 'I';
            if (deg === 'I') templates.abdomen = 'Живот увеличен за счет избыточно развитой подкожной жировой клетчатки, не вздут, участвует в акте дыхания, при пальпации мягкий, безболезненный. Печень не выступает из-под края реберной дуги, край печени эластичный, безболезненный.';
            else templates.abdomen = 'Живот увеличен за счет избыточно развитой подкожной жировой клетчатки, не вздут, участвует в акте дыхания, при пальпации мягкий, безболезненный. Печень не пальпируется в виду избыточно развитой подкожной жировой клетчатки.';
        }
    }
    if (obesityEntry) templates.subcutFat = `Подкожно-жировая клетчатка развита избыточно (ИМТ ${obesityEntry.fields.bmi||''}).`;

    if (isOKI) {
        const dynamicsText = state.dynamicFields['dynamics'] || '';
        const allComplaints = (state.dynamicFields['complaints'] || '') + ' ' + dynamicsText;
        const stoolNumber = extractStoolNumberFromDynamics(dynamicsText);
        templates.stool = templates.stool.replace('___', stoolNumber || '—');
        if (/снижение диуреза|уменьшение диуреза/i.test(allComplaints)) {
            const diurMatch = allComplaints.match(/диурез[а]?\s*(?:снижен|уменьшен)[а]?\s*(?:до)?\s*(\d+)/i);
            const amount = diurMatch && diurMatch[1] ? diurMatch[1] : '___';
            templates.urination = `Мочеиспускание со слов свободное, произвольное, безболезненное. Моча обычной окраски. Диурез снижен до ${amount} мл в сутки.`;
        } else {
            templates.urination = CONFIG.normalTemplates.urination;
        }
    }

    ['abdomen','subcutFat','mucous','stool','urination'].forEach(f => { state.dynamicFields['status_'+f] = templates[f]; });

    const priorityFields = new Set();
    if (diag?.priorityFields) diag.priorityFields.forEach(f => priorityFields.add(f));
    for (const f of allObjFields) {
        if (!state.dynamicFields['status_'+f]) state.dynamicFields['status_'+f] = templates[f] || '';
        const isPriority = priorityFields.has(f);
        h += `<div class="form-group ${isPriority?'priority-field':''}"><label>${isPriority?'⭐ ':''}${labelMap[f]}</label><textarea id="status_${f}" oninput="updateField('status_${f}', this.value); autoResize(this);">${state.dynamicFields['status_'+f]}</textarea></div>`;
    }
    h += `<div class="form-group"><label>Иные сведения, локальный статус</label><textarea id="status_localStatus" oninput="updateField('status_localStatus', this.value); autoResize(this);">${state.dynamicFields['status_localStatus'] || CONFIG.normalTemplates.localStatus}</textarea></div>`;

    c.innerHTML = h;
    c.querySelectorAll('textarea').forEach(ta => autoResize(ta));
    setupAutocomplete(document.getElementById('selfMeds'), SELF_MEDS);
    setupAutocomplete(document.getElementById('antibioticsField'), KNOWN_ANTIBIOTICS);
    if (!state.dynamicFields['complaints']) { const el = document.getElementById('complaintsField'); if (el) state.dynamicFields['complaints'] = el.value; }
    updatePreview();
}

function fillNormal() {
    const diag = state.selectedDiagnosis;
    for (const [k, v] of Object.entries(CONFIG.normalTemplates)) {
        if (k === 'localStatus') continue;
        const el = document.getElementById('status_' + k);
        if (el && !el.value.trim()) { el.value = v; state.dynamicFields['status_'+k] = v; autoResize(el); }
    }
    if (diag?.examPlanTemplate && !document.getElementById('examPlan').value.trim()) {
        document.getElementById('examPlan').value = diag.examPlanTemplate;
        state.dynamicFields['examPlan'] = diag.examPlanTemplate; autoResize(document.getElementById('examPlan'));
    }
    if (diag?.treatmentPlanTemplate && !document.getElementById('treatmentPlan').value.trim()) {
        document.getElementById('treatmentPlan').value = diag.treatmentPlanTemplate;
        state.dynamicFields['treatmentPlan'] = diag.treatmentPlanTemplate; autoResize(document.getElementById('treatmentPlan'));
    }
    updatePreview();
}

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
    const anamnesis = buildAnamnesisMorbi();
    if (anamnesis) L.push(`📝 Анамнез заболевания:\n   ${anamnesis}\n`);
    let vitae = state.dynamicFields['anamnesisVitae'] || '';
    if (state.chronicExpanded.length) {
        const chronText = state.chronicExpanded.map(c => formatChronicItem(c, true)).join(', ');
        vitae = (vitae ? vitae + '. ' : '') + chronText + '.';
    }
    const infectionText = buildInfectionsText();
    L.push(`📖 Анамнез жизни:`);
    if (vitae) L.push(`   ${vitae}`);
    L.push(`   ${infectionText}`);
    const fy = document.getElementById('flgYear').value, fm = document.getElementById('flgMonth').value;
    if (fy && fm) L.push(`   Флюорография: ${fm}.${fy}`);
    if (state.dynamicFields['trauma']) L.push(`   Травмы, операции: ${state.dynamicFields['trauma']}`);
    else L.push('   Травмы, операции: отрицает');
    if (state.dynamicFields['hospital3m']) L.push(`   Лечение в других ЛПУ за 3 мес: ${state.dynamicFields['hospital3m']}`);
    else L.push('   Лечение в других ЛПУ за 3 мес: отрицает');
    if (state.dynamicFields['transfusion']) L.push(`   Трансфузии: ${state.dynamicFields['transfusion']}`);
    else L.push('   Трансфузии: отрицает');
    if (state.dynamicFields['antibiotics']) L.push(`   Антибиотики: ${state.dynamicFields['antibiotics']}`);
    else L.push('   Антибиотики: отрицает');
    if (state.dynamicFields['epidAnamnesis']) L.push(`   Эпид.анамнез: ${state.dynamicFields['epidAnamnesis']}`);
    const albumin = state.dynamicFields['albumin'];
    const ph = state.dynamicFields['ph'];
    if (albumin || ph) {
        let results = [];
        if (albumin) results.push(`альбумин ${albumin} г/л`);
        if (ph) results.push(`pH артериальной крови ${ph}`);
        L.push(`   Получены результаты: ${results.join(', ')}.`);
    }
    if (state.allergies.length) L.push(`   Аллергоанамнез: ${state.allergies.map(a => a.drug + ' (' + a.reaction + ')').join(', ')}`);
    else L.push('   Аллергоанамнез: не отягощен');
    L.push('');
    if (document.getElementById('lnCheckbox').checked) {
        L.push('📋 Сведения о листке нетрудоспособности:');
        L.push('   Выдан листок нетрудоспособности');
        const lnDate = document.getElementById('lnDateInput').value;
        if (lnDate) L.push(`   Дата начала: ${lnDate.split('-').reverse().join('.')}`);
        L.push('');
    }
    L.push('🔬 ФИЗИКАЛЬНОЕ ИССЛЕДОВАНИЕ, ЛОКАЛЬНЫЙ СТАТУС:');
    L.push(`   Тяжесть состояния пациента: ${state.dynamicFields['severity'] || 'Средней тяжести'}`);
    if (state.dynamicFields['severityReason']) L.push(`   Тяжесть состояния обусловлена: ${state.dynamicFields['severityReason']}`);
    L.push(`   Уровень сознания по шкале Глазго: ${state.dynamicFields['glasgow'] || '15'} баллов`);
    const order = ['skin','edema','mucous','subcutFat','lymphNodes','musculoskeletal','respiratory','cardiovascular','abdomen','spleen','stool','peritoneal','rectal','urinary','urination','meningeal'];
    const labelMap = { skin:'Оценка состояния кожных покровов', edema:'Отеки', mucous:'Оценка состояния видимых слизистых оболочек', subcutFat:'Состояние подкожно-жировой клетчатки', lymphNodes:'Результаты пальпации лимфатических узлов', musculoskeletal:'Оценка костно-мышечной системы', respiratory:'Результаты аускультации легких', cardiovascular:'Результаты перкуссии и аускультации сердца', abdomen:'Результаты пальпации органов брюшной полости с определением размеров печени и селезенки', spleen:'Селезенка', stool:'Оценка характера стула и кратности дефекации', peritoneal:'Наличие симптомов раздражения брюшины', rectal:'Результаты пальцевого ректального исследования', urinary:'Результаты обследования мочеполовой системы', urination:'Оценка характера мочеиспускания', meningeal:'Наличие менингеальных симптомов' };
    for (const k of order) {
        const v = state.dynamicFields['status_' + k];
        L.push(`   ${labelMap[k]}: ${v || '—'}`);
    }
    L.push('\n   Термометрия: ' + (document.getElementById('tempInput').value || '—') + ' °C');
    L.push('   ЧСС, пульс: ' + (document.getElementById('pulseInput').value || '—') + ' уд/мин');
    L.push('   Артериальное давление: ' + (document.getElementById('adInput').value || '—') + ' мм рт.ст.');
    L.push('   Частота дыхательных движений: ' + (document.getElementById('rrInput').value || '—') + ' в минуту');
    L.push('   Насыщение крови кислородом (SpO₂): ' + (document.getElementById('spo2Input').value || '—') + ' %');
    L.push('   Рост: ' + (document.getElementById('heightInput').value || '—') + ' см, масса тела: ' + (document.getElementById('weightInput').value || '—') + ' кг');
    if (state.dynamicFields['bmi']) L.push('   ИМТ: ' + state.dynamicFields['bmi'] + ' кг/м²');
    const localVal = state.dynamicFields['status_localStatus'] || CONFIG.normalTemplates.localStatus;
    L.push(`   Иные сведения (при наличии), локальный статус: ${localVal}`);
    L.push('');

    L.push('🩺 ПРЕДВАРИТЕЛЬНЫЙ ДИАГНОЗ:');
    if (state.dynamicFields['mainDisease']) L.push(`   🩺 Основное заболевание: ${state.dynamicFields['mainDisease']}`);
    if (state.dynamicFields['complications']) L.push(`   ⚠ Осложнения основного заболевания: ${state.dynamicFields['complications']}`);
    if (state.dynamicFields['externalCause']) L.push(`   💥 Внешняя причина: ${state.dynamicFields['externalCause']}`);
    if (state.dynamicFields['concomitant']) L.push(`   📎 Сопутствующие заболевания: ${state.dynamicFields['concomitant']}`);
    if (state.dynamicFields['additionalInfo']) L.push(`   📝 Дополнительные сведения: ${state.dynamicFields['additionalInfo']}`);
    if (state.dynamicFields['diagnosisBasis']) L.push(`   🔍 Обоснование предварительного диагноза: ${state.dynamicFields['diagnosisBasis']}`);
    if (state.dynamicFields['hospitalBasis']) L.push(`   🏥 Обоснование госпитализации: ${state.dynamicFields['hospitalBasis']}`);
    if (state.dynamicFields['interventions']) L.push(`   💉 Выполнены медицинские вмешательства: ${state.dynamicFields['interventions']}`);
    L.push('');

    if (state.dynamicFields['examPlan']) L.push(`План обследования:\n   ${state.dynamicFields['examPlan']}\n`);
    if (state.dynamicFields['treatmentPlan']) L.push(`План лечения:\n   ${state.dynamicFields['treatmentPlan']}\n`);
    if (state.dynamicFields['prescriptions']) L.push(`Назначения:\n   ${state.dynamicFields['prescriptions']}\n`);
    L.push('═══════════════════════════════════');
    document.getElementById('previewBox').textContent = L.join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
    state.dynamicFields['severity'] = 'Средней тяжести';
    const interventionsField = document.getElementById('interventions');
    const today = new Date().toLocaleDateString('ru-RU');
    interventionsField.value = `осмотр, измерение АД, Экспресс Ag SARS Cov2 от ${today} - отрицательно`;
    state.dynamicFields['interventions'] = interventionsField.value;
    autoResize(interventionsField);
    setupAutocomplete(document.getElementById('allergyDrug'), ALLERGY_DRUGS);
    setupAutocomplete(document.getElementById('antibioticsField'), KNOWN_ANTIBIOTICS);
    setupABTSelection();
    setupMucousSelection();
    updateDynamicBlock();
    updatePreview();
    checkFLG();
});