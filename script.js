/* ==========================================================================
   5th Semester QA — Script v2.1 (design v6)
   Features: Search, Bookmarks, Progress Tracking, Toast, Theme, URL Routing,
             MCQ Score, Reveal All, Charts, Animations, FAB
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. Global State
// --------------------------------------------------------------------------
let allData = {};
let topicChart;
let searchIndex = []; // For full-text search
let bookmarks = JSON.parse(localStorage.getItem('bookmarks_5sem') || '[]');

let currentState = {
    subject: null, year: null, type: null,
    noteCategory: null, noteSubject: null, view: 'home'
};

// --------------------------------------------------------------------------
// 2. App Lifecycle
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();

    // Show skeleton while loading
    showLoadingSkeleton();

    fetch('5sem.json')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
            allData = data;
            buildSearchIndex();
            initializeApp();
        })
        .catch(err => {
            console.error('Data load error:', err);
            document.getElementById('content-area').innerHTML = `
                <div class="no-results card p-8 mx-4 my-8">
                    <svg class="nr-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    <p>দুঃখিত, ডেটা লোড করা যায়নি।<br><small>JSON ফাইলটি একই ফোল্ডারে আছে কিনা যাচাই করুন।</small></p>
                </div>`;
        });
});

function showLoadingSkeleton() {
    const area = document.getElementById('content-area');
    // Just leave home page visible — skeleton shown in stats/nav
}

function initializeApp() {
    renderNav();
    renderHomeStats();
    setupSearch();
    setupThemeToggle();
    setupFAB();
    setupBookmarksPage();
    updateBookmarkBadge();
    initFontSize();
    initContextMenu();
    initScrollProgressBar();
    initStudyTimer();
    initKeyboardShortcuts();
    addRippleToButtons();
    initReadingBar();
    initHeroHome();
    initBottomNav();

    document.getElementById('home-button').onclick = showHomePage;
    document.getElementById('year-filter').onchange = handleYearChange;

    const syllabusBtn = document.getElementById('syllabus-button');
    const syllabusBtnMobile = document.getElementById('syllabus-button-mobile');
    if (syllabusBtn) syllabusBtn.onclick = showSyllabus;
    if (syllabusBtnMobile) syllabusBtnMobile.onclick = showSyllabus;

    document.getElementById('bookmarks-nav-btn').onclick = showBookmarks;

    // Home feature card click handlers
    initFeatureCardHandlers();
    initChartToggle();

    handleHashChange(true);

    // Reveal intro section
    requestAnimationFrame(() => {
        document.getElementById('intro-section').classList.add('is-visible');
    });
}

// --------------------------------------------------------------------------
// 2b. Feature Card Handlers (Home Page)
// --------------------------------------------------------------------------
function initFeatureCardHandlers() {
    document.querySelectorAll('.feature-card-linked').forEach(card => {
        const action = card.dataset.action;
        card.addEventListener('click', () => handleFeatureCardClick(action));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFeatureCardClick(action);
            }
        });
    });

    // Subject picker close
    const overlay = document.getElementById('subject-picker-overlay');
    document.getElementById('subject-picker-close').onclick = () => closeSubjectPicker();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSubjectPicker(); });
}

// Topic chart: collapsible card (folded by default on phones)
function initChartToggle() {
    const section = document.getElementById('chart-section');
    const title = section?.querySelector('h3');
    if (!title) return;
    title.classList.add('chart-toggle');
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    title.insertAdjacentHTML('beforeend', '<svg class="chart-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>');
    const set = (collapsed) => {
        section.classList.toggle('is-collapsed', collapsed);
        title.setAttribute('aria-expanded', String(!collapsed));
    };
    set(window.innerWidth < 640);
    const toggle = () => set(!section.classList.contains('is-collapsed'));
    title.addEventListener('click', toggle);
    title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
}

function handleFeatureCardClick(action) {
    switch (action) {
        case 'bookmarks':
            showBookmarks();
            break;
        case 'search':
            document.getElementById('global-search')?.focus();
            break;
        case 'mcq':
            showSubjectPicker('MCQ অনুশীলন', 'বিষয় বেছে নিন, তারপর সাল ও MCQ অনুশীলনে যান', 'mcq');
            break;
        case 'chart':
            showSubjectPicker('টপিক চার্ট', 'বিষয় নির্বাচন করুন টপিক বিশ্লেষণ দেখতে', 'chart');
            break;
    }
}

function showSubjectPicker(title, subtitle, mode) {
    const overlay = document.getElementById('subject-picker-overlay');
    const list = document.getElementById('subject-picker-list');
    document.getElementById('subject-picker-title').textContent = title;
    document.getElementById('subject-picker-subtitle').textContent = subtitle;

    list.innerHTML = '';

    // Filter subjects that have MCQ/questions
    const subjects = Object.keys(allData).filter(k => k !== 'syllabus' &&
        (mode === 'browse' ? (allData[k].questions || allData[k].isNoteCategory) : (!allData[k].isNoteCategory && allData[k].questions)));

    if (subjects.length === 0) {
        list.innerHTML = '<p class="text-center picker-empty-msg py-4">কোনো বিষয় পাওয়া যায়নি।</p>';
    }

    subjects.forEach(key => {
        const subj = allData[key];
        const btn = document.createElement('button');
        btn.className = 'subject-picker-btn';

        // Count MCQs
        const totalMCQ = Object.keys(subj.questions || {}).reduce((acc, yr) => {
            return acc + (subj.questions[yr]?.mcq?.length || 0);
        }, 0);
        const years = subj.years || [];
        const noteCount = subj.isNoteCategory ? Object.values(subj.subjects || {}).reduce((n, arr) => n + (arr?.length || 0), 0) : 0;
        const writtenCount = Object.keys(subj.questions || {}).reduce((acc, yr) => acc + (subj.questions[yr]?.written?.length || 0), 0);
        const meta = subj.isNoteCategory
            ? `${toBengaliNum(noteCount)}টি নোট`
            : (years.length > 0 ? toBengaliNum(years[years.length-1]) + '–' + toBengaliNum(years[0]) : '') +
              (mode === 'browse' ? `, ${toBengaliNum(writtenCount)}টি লিখিত · ${toBengaliNum(totalMCQ)}টি MCQ` : (totalMCQ > 0 ? ', ' + toBengaliNum(totalMCQ) + 'টি MCQ' : ''));
        if (mode === 'browse' && currentState.subject === key) btn.classList.add('is-current');

        btn.innerHTML = `
            <span class="picker-icon ${getSubjectColor(key)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${getSubjectSVG(key).match(/<svg[^>]*>([\s\S]*?)<\/svg>/s)?.[1] || ''}</svg>
            </span>
            <div class="picker-info">
                <span class="picker-name">${subj.name}</span>
                <span class="picker-meta">${meta}</span>
            </div>
            <svg class="picker-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        `;

        btn.onclick = () => {
            if (mode === 'browse') {
                closeSubjectPicker();
                selectSubject(key);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (mode === 'chart') {
                closeSubjectPicker();
                selectSubject(key);
                setTimeout(() => {
                    const chartSection = document.getElementById('chart-section');
                    if (chartSection && !chartSection.classList.contains('hidden')) {
                        chartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 350);
            } else if (mode === 'mcq') {
                // Show year selection step inside the picker
                showYearPicker(key, years, subj);
            }
        };

        list.appendChild(btn);
    });

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.documentElement.classList.add('sheet-lock');
    Overlay.opened('picker', () => closeSubjectPicker(true));
}

function closeSubjectPicker(fromHistory) {
    const overlay = document.getElementById('subject-picker-overlay');
    if (overlay.classList.contains('hidden')) return;
    overlay.classList.remove('open');
    document.documentElement.classList.remove('sheet-lock');
    clearTimeout(closeSubjectPicker._t);
    closeSubjectPicker._t = setTimeout(() => { if (!overlay.classList.contains('open')) overlay.classList.add('hidden'); }, 300);
    if (fromHistory !== true) Overlay.closedByUI('picker');
}

function showYearPicker(subjectKey, years, subjData) {
    const list = document.getElementById('subject-picker-list');
    document.getElementById('subject-picker-title').textContent = subjData.name;
    document.getElementById('subject-picker-subtitle').textContent = 'সাল নির্বাচন করুন — MCQ অনুশীলনে যান';

    list.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'year-picker-wrap';

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'year-picker-back';
    backBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
        বিষয় পরিবর্তন করুন
    `;
    backBtn.onclick = () => showSubjectPicker('MCQ অনুশীলন', 'বিষয় বেছে নিন, তারপর সালে MCQ অনুশীলনে যান', 'mcq');
    wrap.appendChild(backBtn);

    // Year buttons — only show years that have MCQ
    const mcqYears = years.filter(yr => (allData[subjectKey]?.questions?.[yr]?.mcq?.length || 0) > 0);
    
    if (mcqYears.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'text-align:center;color:var(--text-3);padding:1.5rem 0;font-size:0.9rem;';
        msg.textContent = 'এই বিষয়ে MCQ প্রশ্ন পাওয়া যায়নি।';
        wrap.appendChild(msg);
    } else {
        mcqYears.forEach(yr => {
            const count = allData[subjectKey]?.questions?.[yr]?.mcq?.length || 0;
            const btn = document.createElement('button');
            btn.className = 'year-btn';
            btn.innerHTML = `
                <span>${toBengaliNum(yr)} সাল</span>
                <span class="year-btn-badge">${toBengaliNum(count)}টি MCQ</span>
            `;
            btn.onclick = () => {
                closeSubjectPicker();
                selectSubjectAndType(subjectKey, String(yr), 'mcq');
            };
            wrap.appendChild(btn);
        });
    }

    list.appendChild(wrap);
}

function selectSubjectAndType(key, year, type) {
    if (!allData[key]) return;
    document.querySelectorAll('#subject-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subject === key);
    });
    hideAllSections();
    document.getElementById('filter-section').classList.remove('hidden');
    currentState.subject = key;
    currentState.year = year;
    currentState.type = type;
    const subjectData = allData[key];
    if (subjectData.analysis?.data?.length > 0) {
        document.getElementById('chart-section').classList.remove('hidden');
        renderChart();
    }
    renderFilters();
    renderQuestions();
    updateHashFromState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


function buildSearchIndex() {
    searchIndex = [];
    Object.keys(allData).forEach(subjectKey => {
        if (subjectKey === 'syllabus') return;
        const subjectData = allData[subjectKey];
        if (!subjectData.questions) return;

        Object.keys(subjectData.questions).forEach(year => {
            const yearData = subjectData.questions[year];
            ['written', 'mcq'].forEach(type => {
                (yearData[type] || []).forEach((item, idx) => {
                    const qText = (item.q || '').replace(/<\/(td|th)>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    searchIndex.push({
                        subjectKey,
                        subjectName: subjectData.name,
                        subjectIcon: subjectData.icon || '📘',
                        year,
                        type,
                        idx,
                        q: qText
                    });
                });
            });
        });
    });
}

function setupSearch() {
    const input = document.getElementById('global-search');
    const dropdown = document.getElementById('search-results-dropdown');
    let debounceTimer;
    let focusedIdx = -1;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        focusedIdx = -1;
        debounceTimer = setTimeout(() => {
            const query = input.value.trim();
            if (query.length < 2) { closeSearch(); return; }
            performSearch(query);
        }, 220);
    });

    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query.length >= 2) performSearch(query);
    });

    // Keyboard navigation within dropdown
    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.search-result-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusedIdx = Math.min(focusedIdx + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle('focused', i === focusedIdx));
            items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusedIdx = Math.max(focusedIdx - 1, 0);
            items.forEach((el, i) => el.classList.toggle('focused', i === focusedIdx));
            items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && focusedIdx >= 0) {
            e.preventDefault();
            items[focusedIdx]?.click();
        } else if (e.key === 'Escape') {
            closeSearch();
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            closeSearch();
        }
    });
}

function performSearch(query) {
    const dropdown = document.getElementById('search-results-dropdown');
    const lower = query.toLowerCase();
    const results = searchIndex.filter(item =>
        item.q.toLowerCase().includes(lower)
    ).slice(0, 12);

    dropdown.innerHTML = '';
    dropdown.classList.remove('hidden');

    if (results.length === 0) {
        dropdown.innerHTML = `<div class="search-empty">“${query.replace(/[<>&"]/g, '')}” দিয়ে কোনো প্রশ্ন পাওয়া যায়নি। অন্য একটা শব্দ লিখে দেখুন।</div>`;
        return;
    }

    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.setAttribute('role', 'option');
        div.setAttribute('tabindex', '0');

        const highlighted = item.q.replace(
            new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<mark>$1</mark>'
        );

        div.innerHTML = `
            <div class="sr-meta">
                <span class="sr-tag">${item.subjectName}</span>
                ${toBengaliNum(item.year)} সাল, ${item.type === 'mcq' ? 'MCQ' : 'লিখিত'}
            </div>
            <div class="sr-q">${highlighted.substring(0, 160)}...</div>
        `;

        div.onclick = () => {
            closeSearch();
            document.getElementById('global-search').value = '';
            // Navigate to the question
            selectSubject(item.subjectKey);
            setTimeout(() => {
                currentState.year = item.year;
                currentState.type = item.type;
                renderFilters();
                renderQuestions(() => {
                    // Try to open/highlight the matching accordion
                    setTimeout(() => {
                        const cards = document.querySelectorAll('#question-display .q-accordion');
                        if (cards[item.idx]) {
                            cards[item.idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const header = cards[item.idx].querySelector('.q-header');
                            if (header && !header.classList.contains('active')) header.click();
                        }
                    }, 400);
                });
            }, 150);
        };

        dropdown.appendChild(div);
    });
}

function closeSearch() {
    document.getElementById('search-results-dropdown').classList.add('hidden');
}

// --------------------------------------------------------------------------
// 4. Navigation & Subject Selection
// --------------------------------------------------------------------------
// Subject key → SVG icon map — Advanced Subject-Matched Icons v4.0
const SUBJECT_SVG_ICONS = {
    // বাংলা — Book with Bengali script pen motif
    bangla: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
        <path d="M8 7h8M8 11h6M8 15h4"/>
        <path d="M17.5 9.5 Q19 8 18.5 10.5" stroke-width="1.5"/>
    </svg>`,

    // ইংরেজি — Open book with speech bubble (language)
    english: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        <path d="M9 8h1m3 0h1"/>
    </svg>`,

    // আইসিটি — Computer monitor with circuit
    ict: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
        <circle cx="7" cy="10" r="1.5" fill="currentColor" opacity="0.5"/>
        <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
        <circle cx="17" cy="10" r="1.5" fill="currentColor" opacity="0.5"/>
        <path d="M7 10h2M13 10h2" stroke-dasharray="1 1"/>
    </svg>`,

    // শিক্ষা মনোবিজ্ঞান — Brain with neural connections
    shikkhaMonobiggan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5a7 7 0 0 0-5.468 2.6A5 5 0 0 0 5 14a5 5 0 0 0 7 4.584A5 5 0 0 0 19 14a5 5 0 0 0-1.532-6.4A7 7 0 0 0 12 5z"/>
        <path d="M12 5v2M9 8l1.5 1.5M15 8l-1.5 1.5M12 13v3"/>
        <circle cx="12" cy="13" r="1.5" fill="currentColor" opacity="0.6"/>
    </svg>`,

    // শিক্ষায় আইসিটি — Laptop with wifi/educational signal
    ict_in_edu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="2"/>
        <path d="M2 20h20"/>
        <path d="M12 11 Q10 9 12 7 Q14 9 12 11Z" fill="currentColor" opacity="0.5"/>
        <path d="M8.5 14.5 Q12 10 15.5 14.5" stroke-width="1.5"/>
        <path d="M6 16.5 Q12 8 18 16.5" stroke-width="1.2" opacity="0.5"/>
    </svg>`,

    // বাংলা পেপার-২ — Pen/writing
    bangla_paper_2: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        <path d="m15 5 4 4"/>
        <path d="M8 20H4"/>
    </svg>`,

    // ইংরেজি পেপার-২ — Speech/dialog
    english_paper_2: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <path d="M8 9h8M8 13h5"/>
    </svg>`,

    // আইসিটি শিক্ষা পেপার-২ — Cloud/database
    ict_education_2: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9"/>
        <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4"/>
    </svg>`,

    // জেন্ডার শিক্ষা — Equality/balance scales
    genderEducation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v6M8 2h8"/>
        <circle cx="8" cy="14" r="4"/>
        <circle cx="16" cy="14" r="4"/>
        <path d="M8 18v2M16 18v2M6 20h4M14 20h4"/>
        <path d="M5 8h14"/>
    </svg>`,

    // বিদ্যালয় সংগঠন — School building
    organizationManagement: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21h18M3 21V7l9-5 9 5v14"/>
        <path d="M9 21v-6h6v6"/>
        <rect x="10" y="9" width="4" height="4" rx="0.5"/>
        <path d="M8 10V9M16 10V9"/>
        <path d="M12 2v3"/>
    </svg>`,

    // ক্লাস নোট — Notepad with checkmark
    classNotes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M9 13l2 2 4-4"/>
    </svg>`,

    _default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
        <path d="M8 7h8M8 11h6"/>
    </svg>`
};

const SUBJECT_ICON_COLORS = {
    bangla: 'c-blue', english: 'c-green', ict: 'c-cyan',
    shikkhaMonobiggan: 'c-purple', ict_in_edu: 'c-indigo',
    bangla_paper_2: 'c-rose', english_paper_2: 'c-teal',
    ict_education_2: 'c-amber', genderEducation: 'c-pink',
    organizationManagement: 'c-orange', classNotes: 'c-green',
    _default: 'c-indigo'
};

// ── 5th semester subject keys ──
SUBJECT_SVG_ICONS.bangla_3rd_paper = SUBJECT_SVG_ICONS.bangla_paper_2;
SUBJECT_SVG_ICONS.english_3rd_paper = SUBJECT_SVG_ICONS.english_paper_2;
SUBJECT_SVG_ICONS.ict_education_3rd_paper = SUBJECT_SVG_ICONS.ict;
// শিক্ষায় পরিমাপ ও মূল্যায়ন — clipboard with chart & check
SUBJECT_SVG_ICONS.evaluation_in_education = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="4" width="14" height="17" rx="2"/>
        <path d="M9 2h6v4H9z"/>
        <path d="M9 17v-3"/><path d="M12 17v-6"/><path d="M15 17v-4"/>
    </svg>`;
// শিখন শেখানো পদ্ধতি ও কৌশল — presentation board with teacher pointer
SUBJECT_SVG_ICONS.teaching_learning_methods_and_techniques = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="12" rx="1.5"/>
        <path d="M7 21l5-6 5 6"/>
        <path d="M7 8h6"/><path d="M7 11h4"/>
        <path d="m15 10 2-2 2 2"/>
    </svg>`;
Object.assign(SUBJECT_ICON_COLORS, {
    bangla_3rd_paper: 'c-rose', english_3rd_paper: 'c-teal', ict_education_3rd_paper: 'c-cyan',
    evaluation_in_education: 'c-amber', teaching_learning_methods_and_techniques: 'c-purple'
});

function getSubjectSVG(key) {
    return SUBJECT_SVG_ICONS[key] || SUBJECT_SVG_ICONS._default;
}
function getSubjectColor(key) {
    return SUBJECT_ICON_COLORS[key] || SUBJECT_ICON_COLORS._default;
}

function renderNav() {
    const nav = document.getElementById('subject-nav');
    nav.innerHTML = '';
    Object.keys(allData).forEach(key => {
        if (key === 'syllabus') return;
        const subject = allData[key];
        const btn = document.createElement('button');
        btn.className = 'neu-btn';
        const iconSvg = getSubjectSVG(key);
        const innerSVG = iconSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/s)?.[1] || '';
        const colorClass = getSubjectColor(key);
        btn.innerHTML = `
            <span class="nav-icon-wrap ${colorClass}" style="display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24">${innerSVG}</svg>
            </span>
            <span>${subject.name}</span>
        `;
        btn.dataset.subject = key;
        btn.onclick = () => selectSubject(key);
        nav.appendChild(btn);
    });
}

function selectSubject(key) {
    if (!allData[key]) return;
    const subjectData = allData[key];

    // Update nav active state
    document.querySelectorAll('#subject-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subject === key);
    });

    hideAllSections();
    document.getElementById('filter-section').classList.remove('hidden');

    // Reset year/type when switching subjects — prevents stale state from previous subject
    const prevSubject = currentState.subject;
    currentState.subject = key;

    if (prevSubject !== key) {
        currentState.year = null;
        currentState.type = null;
        currentState.noteSubject = null; // class notes state রিসেট
    }

    // Handle class notes category
    if (subjectData.isNoteCategory) {
        renderClassNoteFilters(subjectData);
        const subs = subjectData.subjects || {};
        const first = currentState.noteSubject && subs[currentState.noteSubject]
            ? currentState.noteSubject
            : (Object.keys(subs).find(k => (subs[k] || []).length) || Object.keys(subs)[0]);
        if (first) selectNoteSubject(first); else updateHashFromState();
        return;
    }

    currentState.year = currentState.year || String(subjectData.years[0]);
    // Ensure the stored year actually exists for this subject
    if (!subjectData.years.includes(Number(currentState.year)) && !subjectData.years.includes(currentState.year)) {
        currentState.year = String(subjectData.years[0]);
    }
    const availableTypes = subjectData.questions[currentState.year] || {};
    currentState.type = currentState.type ||
        (availableTypes.written?.length ? 'written' : 'mcq');

    // Chart
    if (subjectData.analysis?.data?.length > 0) {
        document.getElementById('chart-section').classList.remove('hidden');
        renderChart();
    }

    renderFilters();
    renderQuestions();
    updateHashFromState();
}

function renderClassNoteFilters(subjectData) {
    const filterSection = document.getElementById('filter-section');
    filterSection.classList.remove('hidden');

    const regularFilters = document.getElementById('regular-filters-wrap');
    const notesFilter = document.getElementById('classnotes-filters');
    if (regularFilters) regularFilters.style.display = 'none';
    if (notesFilter) {
        notesFilter.classList.remove('hidden');
        notesFilter.innerHTML = '';
        Object.keys(subjectData.subjects || {}).forEach(sk => {
            const subj = allData[sk] || { name: sk };
            const btn = document.createElement('button');
            btn.className = 'neu-btn text-sm';
            const cnt = (subjectData.subjects[sk] || []).length;
            btn.innerHTML = `${subj.name || sk}${cnt ? ` <span class="note-count">${toBengaliNum(cnt)}</span>` : ''}`;
            btn.dataset.key = sk;
            btn.onclick = () => selectNoteSubject(sk);
            notesFilter.appendChild(btn);
        });
    }
}

function showHomePage(fromRoute) {
    hideAllSections();
    document.getElementById('intro-section').classList.remove('hidden');
    document.getElementById('intro-section').classList.add('is-visible');
    document.getElementById('stats-bar').classList.add('hidden');
    document.querySelectorAll('#subject-nav button').forEach(btn => btn.classList.remove('active'));
    currentState = { subject: null, year: null, type: null, noteCategory: null, noteSubject: null, view: 'home' };
    updateHashFromState();
    closeReadingBar();
    if (fromRoute !== true) window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// 5. Render Filters
// --------------------------------------------------------------------------
function renderFilters() {
    const subjectData = allData[currentState.subject];
    if (!subjectData || subjectData.isNoteCategory) return;

    // Show regular filters, hide notes
    const classnoteFilters = document.getElementById('classnotes-filters');
    if (classnoteFilters) classnoteFilters.classList.add('hidden');

    // Always restore regular filters wrap visibility (may have been hidden by class notes)
    const regularFilters = document.getElementById('regular-filters-wrap');
    if (regularFilters) regularFilters.style.display = '';

    const yearFilter = document.getElementById('year-filter');
    yearFilter.innerHTML = '';
    subjectData.years.forEach(yr => {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = toBengaliNum(yr);
        yearFilter.appendChild(opt);
    });
    yearFilter.value = currentState.year;

    const typeFilter = document.getElementById('type-filter');
    typeFilter.innerHTML = '';
    const available = subjectData.questions[currentState.year] || {};

    if (available.written?.length) {
        const btn = createTypeBtn('written', `<svg class="type-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> লিখিত`, currentState.type === 'written');
        typeFilter.appendChild(btn);
    }
    if (available.mcq?.length) {
        const btn = createTypeBtn('mcq', `<svg class="type-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> MCQ`, currentState.type === 'mcq');
        typeFilter.appendChild(btn);
    }
}

function createTypeBtn(type, label, isActive) {
    const btn = document.createElement('button');
    btn.className = `neu-btn text-sm ${isActive ? 'active' : ''}`;
    btn.dataset.type = type;
    btn.innerHTML = label;
    btn.onclick = () => handleTypeChange(type);
    return btn;
}

function handleYearChange() {
    currentState.year = document.getElementById('year-filter').value;
    // Reset type
    const available = allData[currentState.subject]?.questions[currentState.year] || {};
    currentState.type = available.written?.length ? 'written' : 'mcq';
    renderFilters();
    renderQuestions();
    updateHashFromState();
}

function handleTypeChange(type) {
    currentState.type = type;
    document.querySelectorAll('#type-filter button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    renderQuestions();
    updateHashFromState();
}

// --------------------------------------------------------------------------
// 6. Render Questions
// --------------------------------------------------------------------------
function renderQuestions(callback) {
    const display = document.getElementById('question-display');
    display.innerHTML = '';

    const { subject, year, type } = currentState;
    if (!subject || !year || !type) return;

    const questions = allData[subject]?.questions?.[year]?.[type] || [];

    if (questions.length === 0) {
        display.innerHTML = `<div class="no-results card p-8">
            <svg class="nr-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
            <p>এই সালে এই ধরনের প্রশ্ন পাওয়া যায়নি।</p></div>`;
        hideMCQScoreUI();
        return;
    }

    if (type === 'mcq') {
        renderMCQQuestions(questions, display);
    } else {
        renderWrittenQuestions(questions, display);
    }

    setTimeout(() => {
        applyScrollAnimation('#question-display .q-accordion, #question-display .mcq-card');
        if (callback) callback();
    }, 50);
}

function renderWrittenQuestions(questions, container) {
    hideMCQScoreUI();
    // Add reading progress bar
    const progressBar = renderReadingProgressBar();
    container.appendChild(progressBar);
    questions.forEach((item, idx) => {
        const el = createWrittenAccordion(item, idx);
        container.appendChild(el);
    });
}

function createWrittenAccordion(item, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'q-accordion mb-3 reveal-on-scroll';

    const shareTarget = {
        subject: currentState.subject,
        year: currentState.year,
        type: 'written',
        idx,
        qText: (item.q || '').replace(/<[^>]*>/g, '')
    };

    const header = document.createElement('div');
    header.className = 'q-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `
        <span class="q-num-badge">${isEnglishText((item.q || '').replace(/<[^>]*>/g, '')) ? idx + 1 : toBengaliNum(idx + 1)}</span>
        <span class="flex-1 text-left">${formatQuestionText(item.q)}</span>
        <div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0">
            <button class="bookmark-btn" data-qid="${btoa(encodeURIComponent(item.q.substring(0,80))).substring(0,20)}" onclick="toggleBookmark(event, '${currentState.subject}', '${currentState.year}', 'written', ${idx})" aria-label="বুকমার্ক">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
            </button>
            <div class="q-chevron">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
        </div>
    `;

    const body = document.createElement('div');
    body.className = 'q-body';

    const content = document.createElement('div');
    content.className = 'answer-content';
    content.innerHTML = item.a || '<p>উত্তর পাওয়া যায়নি।</p>';
    sanitizeContent(content);

    // Share hint + read done + print buttons at bottom of answer
    const actionsRow = createAnswerActions(shareTarget, idx);
    content.appendChild(actionsRow);

    body.appendChild(content);
    wrap.appendChild(header);
    wrap.appendChild(body);

    header.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-btn')) return;
        toggleAccordion(header, body);
    });
    header.addEventListener('keydown', (e) => {
        if (e.target !== header) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAccordion(header, body); }
    });

    // Attach long-press / right-click share on header
    attachShareHandlers(header, shareTarget);

    // Update bookmark icon
    updateBookmarkIcon(header.querySelector('.bookmark-btn'), currentState.subject, currentState.year, 'written', idx);

    return wrap;
}

function getStickyOffset() {
    const bar = document.getElementById('top-sticky-bar');
    return (bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 60) + 10;
}

function scrollInstant(top) {
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
}

function setAccordionState(body, open) {
    const header = body.previousElementSibling;
    body.classList.toggle('open', open);
    header?.classList.toggle('active', open);
    header?.setAttribute('aria-expanded', String(open));
    body.closest('.q-accordion')?.classList.toggle('is-open', open);
}

// Collapse without animation (used for the *other* open item, so nothing slides under the finger)
function collapseInstantly(bodies) {
    bodies.forEach(b => { b.classList.add('no-anim'); setAccordionState(b, false); });
    void document.body.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => bodies.forEach(b => b.classList.remove('no-anim'))));
}

function toggleAccordion(header, body, opts = {}) {
    const isOpen = body.classList.contains('open');
    const accordion = header.closest('.q-accordion');
    const container = accordion?.parentElement || document;
    const others = Array.from(container.querySelectorAll('.q-body.open')).filter(b => b !== body);
    const offset = getStickyOffset();

    // 1) Close the previously open answer instantly and keep the tapped question exactly under the finger
    if (others.length) {
        const before = header.getBoundingClientRect().top;
        collapseInstantly(others);
        const after = header.getBoundingClientRect().top;
        if (Math.abs(after - before) > 1) scrollInstant(window.scrollY + (after - before));
    }

    // 2) Closing this one
    if (isOpen) {
        const top = header.getBoundingClientRect().top;
        if (top < offset) {
            // reader is deep inside the answer — snap back to the question, then fold it
            collapseInstantly([body]);
            scrollInstant(window.scrollY + header.getBoundingClientRect().top - offset);
        } else {
            setAccordionState(body, false);
        }
        closeReadingBar();
        return;
    }

    // 3) Opening — bring the question to the top so reading starts at line one
    setAccordionState(body, true);
    openAccordion = { header, body, accordion };
    if (!opts.noScroll) {
        const r = header.getBoundingClientRect();
        const needs = r.top < offset || r.top > window.innerHeight * 0.32;
        if (needs) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - offset), behavior: 'smooth' });
    }
    updateReadingBar();
}

// ── Reading bar: a slim strip under the top bar while you read a long answer ──
let openAccordion = null, rbTicking = false;

function initReadingBar() {
    const bar = document.getElementById('reading-bar');
    if (!bar) return;
    document.getElementById('rb-jump').addEventListener('click', () => {
        if (!openAccordion) return;
        const top = openAccordion.header.getBoundingClientRect().top + window.scrollY - getStickyOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
    document.getElementById('rb-close').addEventListener('click', () => {
        if (!openAccordion) return;
        toggleAccordion(openAccordion.header, openAccordion.body);
    });
    window.addEventListener('scroll', () => {
        if (rbTicking) return;
        rbTicking = true;
        requestAnimationFrame(() => { rbTicking = false; updateReadingBar(); });
    }, { passive: true });
}

function updateReadingBar() {
    const bar = document.getElementById('reading-bar');
    if (!bar) return;
    const o = openAccordion;
    if (!o || !o.body.classList.contains('open') || !document.body.contains(o.header)) { closeReadingBar(); return; }
    const offset = getStickyOffset();
    const hRect = o.header.getBoundingClientRect();
    const bRect = o.body.getBoundingClientRect();
    const show = hRect.bottom < offset - 4 && bRect.bottom > offset + 90;
    if (show && !bar.classList.contains('show')) {
        const num = o.header.querySelector('.q-num-badge')?.textContent || '';
        const tClone = o.header.querySelector('.flex-1')?.cloneNode(true);
        tClone?.querySelectorAll('.note-meta, .bm-meta, table').forEach(n => n.remove());
        const txt = (tClone?.textContent || '').replace(/\s+/g, ' ').replace(/^([০-৯\d]+)[।.)\s]+/, '').trim();
        document.getElementById('rb-num').textContent = num;
        document.getElementById('rb-text').textContent = txt;
        bar.style.top = (offset - 10) + 'px';
    }
    bar.classList.toggle('show', show);
    bar.setAttribute('aria-hidden', String(!show));
}

function closeReadingBar() {
    const bar = document.getElementById('reading-bar');
    if (bar) { bar.classList.remove('show'); bar.setAttribute('aria-hidden', 'true'); }
}

// ── Hero sheet works as a home button ──
function initHeroHome() {
    const hero = document.getElementById('hero-home');
    if (!hero) return;
    const go = () => {
        if (document.getElementById('intro-section').classList.contains('hidden')) showHomePage();
        else window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    hero.addEventListener('click', go);
    hero.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
}

// ── Bottom navigation (phones) ──
function initBottomNav() {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.bn-item');
        if (!btn) return;
        switch (btn.dataset.nav) {
            case 'home': showHomePage(); break;
            case 'subjects': showSubjectPicker('বিষয় বেছে নিন', 'যে বিষয়ের প্রশ্ন বা নোট পড়তে চান', 'browse'); break;
            case 'search': {
                const input = document.getElementById('global-search');
                window.scrollTo({ top: 0, behavior: 'instant' });
                input?.focus();
                break;
            }
            case 'bookmarks': showBookmarks(); break;
            case 'syllabus': showSyllabus(); break;
        }
    });
    syncBottomNav();
}

function syncBottomNav() {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    const vis = id => !document.getElementById(id)?.classList.contains('hidden');
    let cur = 'home';
    if (vis('bookmarks-section')) cur = 'bookmarks';
    else if (vis('syllabus-section')) cur = 'syllabus';
    else if (!vis('intro-section')) cur = 'subjects';
    nav.querySelectorAll('.bn-item').forEach(b => {
        const on = b.dataset.nav === cur;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
}

// ── Language detection: true if text is primarily English/ASCII ──
function isEnglishText(text) {
    const clean = (text || '').replace(/[\s\d.,!?()\'\"-]/g, '');
    if (!clean.length) return false;
    const ascii = clean.split('').filter(c => c.charCodeAt(0) < 128).length;
    return ascii / clean.length > 0.75;
}

// ── Convert English digit to Bengali numeral ──
function toBengaliNum(n) {
    const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(n).split('').map(d => bn[+d] ?? d).join('');
}

function renderMCQQuestions(questions, container) {
    showMCQScoreUI(questions.length);

    const wrap = document.createElement('div');
    wrap.className = 'mcq-wrap';

    questions.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'mcq-card reveal-on-scroll';

        const shareTarget = {
            subject: currentState.subject,
            year: currentState.year,
            type: 'mcq',
            idx,
            qText: (item.q || '').replace(/<[^>]*>/g, '')
        };

        // Detect language per-question (question + all options combined)
        const fullText = (item.q || '') + ' ' + (item.o || []).join(' ');
        const isEn = isEnglishText(fullText);
        const bnLetters = ['ক', 'খ', 'গ', 'ঘ'];
        const enLetters = ['a', 'b', 'c', 'd'];
        const letters = isEn ? enLetters : bnLetters;

        // Badge number: Bengali numerals for Bengali, Arabic for English
        const badgeLabel = isEn ? (idx + 1) : toBengaliNum(idx + 1);

        // Strip leading serial from question text (anchored at ^ — safe for mid-text numbers)
        const cleanQ = (item.q || '').replace(/^([০-৯\d]+)[।.)\s]+/, '');

        card.dataset.correctIdx = item.a;
        card.dataset.isEn = isEn ? '1' : '0';

        card.innerHTML = `
            <div class="mcq-q-header">
                <span class="q-num-badge mcq-badge">${badgeLabel}</span>
                <p class="mcq-q-text${isEn ? ' en' : ''}">${cleanQ}</p>
                <button class="mcq-share" type="button" aria-label="শেয়ার করুন" title="শেয়ার করুন"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
            </div>
            <div class="mcq-options">
                ${(item.o || []).map((opt, oi) => `
                    <div class="mcq-option" data-opt="${oi}" tabindex="0" role="button"
                         aria-label="${letters[oi]}: ${opt}">
                        <span class="opt-letter${isEn ? ' en' : ''}">${letters[oi]}</span>
                        <span class="opt-text">${opt}</span>
                        <span class="option-icon" aria-hidden="true"></span>
                    </div>
                `).join('')}
            </div>
        `;

        card.querySelectorAll('.mcq-option').forEach(optEl => {
            optEl.addEventListener('click', () => handleMCQOptionClick(optEl, item, card));
            optEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMCQOptionClick(optEl, item, card);
                }
            });
        });

        // Badge hover (like written q-num-badge)
        card.addEventListener('mouseenter', () => {
            if (!card.dataset.answered) card.querySelector('.mcq-badge')?.classList.add('hov');
        });
        card.addEventListener('mouseleave', () => {
            card.querySelector('.mcq-badge')?.classList.remove('hov');
        });

        // Share: visible button + long-press / right-click
        const mShare = card.querySelector('.mcq-share');
        mShare.addEventListener('click', (e) => { e.stopPropagation(); openCtxMenu({ anchorRect: mShare.getBoundingClientRect() }, shareTarget); });
        attachShareHandlers(card.querySelector('.mcq-q-text'), shareTarget);

        wrap.appendChild(card);
    });

    container.appendChild(wrap);
}

function handleMCQOptionClick(optionEl, item, card) {
    if (card.dataset.answered) return;
    card.dataset.answered = 'true';
    card.querySelectorAll('.mcq-option').forEach(el => {
        el.style.pointerEvents = 'none';
        el.removeAttribute('tabindex');
    });

    const correctIdx = item.a;
    const selectedIdx = Array.from(card.querySelectorAll('.mcq-option')).indexOf(optionEl);
    const correctEl = card.querySelectorAll('.mcq-option')[correctIdx];
    const isCorrect = selectedIdx === correctIdx;

    correctEl.classList.add('correct');
    correctEl.querySelector('.option-icon').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>`;

    if (!isCorrect) {
        optionEl.classList.add('incorrect');
        optionEl.querySelector('.option-icon').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    }

    // Badge animate (like written q-num-badge active state)
    const badge = card.querySelector('.mcq-badge');
    if (badge) {
        badge.classList.remove('hov');
        badge.classList.add(isCorrect ? 'ans-ok' : 'ans-no');
        void badge.offsetWidth; // reflow to restart animation
        badge.classList.add('pulse');
        setTimeout(() => badge.classList.remove('pulse'), 500);
    }

    // Card-level glow border
    card.classList.add(isCorrect ? 'c-ok' : 'c-no');

    updateMCQScore();
}

function showMCQScoreUI(total) {
    document.getElementById('mcq-score-wrap').classList.remove('hidden');
    const mcqControls = document.getElementById('mcq-controls');
    mcqControls.classList.remove('hidden');
    mcqControls.style.display = 'flex';
    document.getElementById('mcq-progress-bar-wrap').classList.remove('hidden');
    document.getElementById('mcq-score').textContent = '0';
    document.getElementById('mcq-total').textContent = total;
    document.getElementById('mcq-progress-bar').style.width = '0%';
    // Activate dynamic pill
    updatePillScore(0, total);
    activateMCQPillMode();
}

function hideMCQScoreUI() {
    document.getElementById('mcq-score-wrap').classList.add('hidden');
    const mcqControls = document.getElementById('mcq-controls');
    mcqControls.classList.add('hidden');
    mcqControls.style.display = 'none';
    document.getElementById('mcq-progress-bar-wrap').classList.add('hidden');
    // Deactivate pill
    deactivateMCQPillMode();
}

function updateMCQScore() {
    const total = parseInt(document.getElementById('mcq-total').textContent || '0');
    const answered = document.querySelectorAll('.mcq-card[data-answered]').length;
    const incorrect = document.querySelectorAll('.mcq-option.incorrect').length;
    const score = answered - incorrect;
    document.getElementById('mcq-score').textContent = score;

    // Update progress bar
    const pct = total > 0 ? (answered / total) * 100 : 0;
    document.getElementById('mcq-progress-bar').style.width = pct + '%';

    // Update dynamic pill
    updatePillScore(score, total);

    // Completion toast
    if (answered === total && total > 0) {
        const pct = Math.round((score / total) * 100);
        showToast(`🎉 সম্পন্ন! স্কোর: ${score}/${total} (${pct}%)`, pct >= 70 ? 'success' : 'info');
    }
}

function resetMCQAnswers() {
    document.querySelectorAll('.mcq-card').forEach(card => {
        card.removeAttribute('data-answered');
        card.removeAttribute('data-revealed');
        card.classList.remove('c-ok', 'c-no');
        card.querySelectorAll('.mcq-option').forEach(el => {
            el.style.pointerEvents = 'auto';
            el.setAttribute('tabindex', '0');
            el.classList.remove('correct', 'incorrect');
            el.querySelector('.option-icon').innerHTML = '';
        });
        const badge = card.querySelector('.mcq-badge');
        if (badge) badge.classList.remove('hov', 'ans-ok', 'ans-no', 'pulse');
    });
    document.getElementById('mcq-score').textContent = '0';
    document.getElementById('mcq-progress-bar').style.width = '0%';
    const total = parseInt(document.getElementById('mcq-total').textContent || '0');
    updatePillScore(0, total);
    showToast('✅ রিসেট হয়েছে', 'info');
}

function revealAllAnswers() {
    const mcqCards = document.querySelectorAll('.mcq-card');
    let mcqCount = mcqCards.length;

    if (mcqCount > 0) {
        // ── Step 1: Full reset — clear any practice attempts ──
        mcqCards.forEach(card => {
            card.removeAttribute('data-answered');
            card.removeAttribute('data-revealed');
            card.classList.remove('c-ok', 'c-no');
            card.querySelectorAll('.mcq-option').forEach(el => {
                el.style.pointerEvents = 'none'; // will lock after reveal
                el.setAttribute('tabindex', '0');
                el.classList.remove('correct', 'incorrect');
                el.querySelector('.option-icon').innerHTML = '';
            });
            const badge = card.querySelector('.mcq-badge');
            if (badge) badge.classList.remove('hov', 'ans-ok', 'ans-no', 'pulse');
        });

        // ── Step 2: Show only the correct answer on every card ──
        mcqCards.forEach(card => {
            const correctIdx = parseInt(card.dataset.correctIdx);
            if (isNaN(correctIdx)) return;

            card.dataset.answered = 'true';
            card.dataset.revealed = 'true';
            card.classList.add('c-ok'); // neutral green glow for reveal

            card.querySelectorAll('.mcq-option').forEach((el, i) => {
                el.style.pointerEvents = 'none';
                el.removeAttribute('tabindex');
                if (i === correctIdx) {
                    el.classList.add('correct');
                    el.querySelector('.option-icon').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>`;
                }
            });

            const badge = card.querySelector('.mcq-badge');
            if (badge) {
                badge.classList.add('ans-ok', 'pulse');
                setTimeout(() => badge.classList.remove('pulse'), 500);
            }
        });

        // Update score: revealed cards count as correct (full score)
        const total = mcqCards.length;
        document.getElementById('mcq-score').textContent = total;
        document.getElementById('mcq-progress-bar').style.width = '100%';
        updatePillScore(total, total);
        showToast('📖 সব সঠিক উত্তর দেখানো হয়েছে', 'success');
        return;
    }

    // ── Written: open all accordions ──
    let writtenOpened = 0;
    document.querySelectorAll('#question-display .q-header:not(.active)').forEach(h => {
        const accordion = h.closest('.q-accordion');
        const body = h.nextElementSibling;
        if (body) {
            body.classList.add('open');
            h.classList.add('active');
            accordion?.classList.add('is-open');
            writtenOpened++;
        }
    });

    if (writtenOpened > 0) {
        showToast('📖 সব উত্তর দেখানো হয়েছে', 'success');
    } else {
        showToast('✅ সব প্রশ্নের উত্তর ইতোমধ্যে দেখা হয়েছে', 'info');
    }
}

// --------------------------------------------------------------------------
// 7. Chart
// --------------------------------------------------------------------------
function renderChart() {
    const subjectData = allData[currentState.subject];
    if (!subjectData?.analysis) return;

    const css = getComputedStyle(document.body);
    const v = (name) => css.getPropertyValue(name).trim();
    const jade = v('--jade') || '#0a7f6f';
    const ink2 = v('--ink-2') || '#3c5759';
    const ink3 = v('--ink-3') || '#6b8586';
    const line = v('--line') || 'rgba(15,42,46,0.09)';
    const solid = v('--solid') || '#f6faf9';
    const ink = v('--ink') || '#0f2a2e';
    const uiFont = "'Anek Bangla', 'Kalpurush', sans-serif";

    const canvas = document.getElementById('topicChart');
    const ctx = canvas.getContext('2d');
    if (topicChart) topicChart.destroy();

    const data = subjectData.analysis.data;
    // horizontal bars keep long Bangla topic names readable; height follows the topic count
    const narrow = window.innerWidth < 640;
    canvas.parentNode.style.height = `${data.length * (narrow ? 30 : 32) + 24}px`;
    // the three most-asked topics stand out; the rest recede
    const ranked = [...data].sort((a, b) => b - a);
    const cutoff = ranked[Math.min(2, ranked.length - 1)];
    const strong = data.map(d => d >= cutoff);

    topicChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: subjectData.analysis.labels,
            datasets: [{
                label: 'প্রশ্নের সংখ্যা',
                data,
                backgroundColor: strong.map(s => s ? jade : jade + '55'),
                hoverBackgroundColor: jade,
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.78,
                categoryPercentage: 0.9,
                maxBarThickness: 22,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: ink,
                    titleColor: solid,
                    bodyColor: solid,
                    titleFont: { family: uiFont, size: 14, weight: '600' },
                    bodyFont: { family: uiFont, size: 13 },
                    padding: 10,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: { label: (c) => `${toBengaliNum(c.parsed.x)} বার প্রশ্ন এসেছে` }
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: ink2, font: { family: uiFont, size: narrow ? 12.5 : 14 }, autoSkip: false, padding: 6,
                        callback: function (v) {
                            const t = this.getLabelForValue(v);
                            const max = narrow ? 22 : 40;
                            return t.length > max ? t.slice(0, max - 1) + '…' : t;
                        }
                    },
                    grid: { display: false },
                    border: { display: false }
                },
                x: {
                    position: 'top',
                    ticks: { color: ink3, font: { family: uiFont, size: 12 }, precision: 0, callback: (v) => toBengaliNum(v) },
                    grid: { color: line },
                    border: { display: false }
                }
            },
            animation: { duration: 700, easing: 'easeOutQuart' }
        }
    });
}

// --------------------------------------------------------------------------
// 8. Syllabus
// --------------------------------------------------------------------------
// Subject-specific colors and labels for syllabus
const SYL_META = {
    bangla:              { color: 'syl-blue',   label: 'বাংলা পেপার-১' },
    english:             { color: 'syl-green',  label: 'ইংরেজি পেপার-১' },
    ict:                 { color: 'syl-cyan',   label: 'আইসিটি পেপার-১' },
    shikkhaMonobiggan:   { color: 'syl-purple', label: 'শিক্ষা মনোবিজ্ঞান' },
    ict_in_edu:          { color: 'syl-blue',   label: 'শিক্ষায় আইসিটি' },
    bangla_paper_2:      { color: 'syl-rose',   label: 'বাংলা পেপার-২' },
    english_paper_2:     { color: 'syl-teal',   label: 'ইংরেজি পেপার-২' },
    ict_education_2:     { color: 'syl-amber',  label: 'আইসিটি পেপার-২' },
    genderEducation:     { color: 'syl-pink',   label: 'জেন্ডার শিক্ষা' },
    organizationManagement: { color: 'syl-orange', label: 'বিদ্যালয় সংগঠন' },
    teaching_learning_methods_and_techniques: { color: 'syl-purple', label: 'শিখন-শেখানো পদ্ধতি ও কৌশল' },
    evaluation_in_education: { color: 'syl-amber', label: 'শিক্ষায় পরিমাপ ও মূল্যায়ন' },
    bangla_3rd_paper:    { color: 'syl-rose',   label: 'বাংলা পেপার-৩' },
    english_3rd_paper:   { color: 'syl-teal',   label: 'ইংরেজি পেপার-৩' },
    ict_education_3rd_paper: { color: 'syl-cyan', label: 'আইসিটি পেপার-৩' },
};

function showSyllabus(fromRoute) {
    if (fromRoute !== true) { commitView('syllabus'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    hideAllSections();
    const section = document.getElementById('syllabus-section');
    section.classList.remove('hidden');
    document.querySelectorAll('#subject-nav button').forEach(btn => btn.classList.remove('active'));
    currentState = { ...currentState, view: 'syllabus' };

    const grid = document.getElementById('syllabus-grid');
    grid.innerHTML = '';

    // Redesign header dynamically
    const header = section.querySelector('.syllabus-header');
    if (header) {
        header.innerHTML = `
            <div class="syllabus-header-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                    <path d="m9 9.5 2 2 4-4"/>
                </svg>
            </div>
            <div class="syllabus-header-text">
                <h2>সিলেবাস</h2>
                <p>৫ম সেমিস্টার — বিষয়ভিত্তিক পাঠ্যক্রম</p>
            </div>
        `;
    }

    Object.keys(allData.syllabus || {}).forEach((key, index) => {
        const meta = SYL_META[key] || { color: 'syl-blue', label: allData[key]?.name || key };
        const displayName = meta.label || (allData[key]?.name) || key;
        const svgContent = SUBJECT_SVG_ICONS[key] || SUBJECT_SVG_ICONS._default;
        const innerSVG = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || '';

        const btn = document.createElement('button');
        btn.className = `syl-btn ${meta.color}`;
        btn.dataset.key = key;
        btn.style.animationDelay = `${index * 0.05}s`;
        btn.innerHTML = `
            <div class="syl-btn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${innerSVG}</svg>
            </div>
            <span class="syl-btn-label">${displayName}</span>
        `;
        btn.onclick = () => {
            grid.querySelectorAll('.syl-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderSyllabusContent(key);
        };
        // Apply scroll reveal
        btn.classList.add('reveal-on-scroll');
        grid.appendChild(btn);
    });

    document.getElementById('syllabus-content-box').classList.add('hidden');
    document.getElementById('syllabus-content').innerHTML = '';

    // Trigger animation
    setTimeout(() => {
        grid.querySelectorAll('.syl-btn').forEach(btn => animObserver.observe(btn));
    }, 50);
}

function renderSyllabusContent(key, showTranslated = false) {
    const box = document.getElementById('syllabus-content-box');
    const content = document.getElementById('syllabus-content');
    const sylData = allData.syllabus?.[key];
    const meta = SYL_META[key] || { color: 'syl-blue', label: allData[key]?.name || key };
    const svgContent = SUBJECT_SVG_ICONS[key] || SUBJECT_SVG_ICONS._default;
    const innerSVG = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || '';

    if (!sylData) {
        box.classList.remove('hidden');
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        content.innerHTML = `<p class="text-center" style="color:var(--text-3);padding:2rem">এই বিষয়ের সিলেবাস পাওয়া যায়নি।</p>`;
        return;
    }

    box.classList.remove('hidden');

    // Render a rich header above the content
    const colorMap = {
        'syl-blue': 'linear-gradient(135deg,#2563eb,#3b82f6)',
        'syl-green': 'linear-gradient(135deg,#059669,#10b981)',
        'syl-purple': 'linear-gradient(135deg,#7c3aed,#8b5cf6)',
        'syl-cyan': 'linear-gradient(135deg,#0891b2,#06b6d4)',
        'syl-rose': 'linear-gradient(135deg,#e11d48,#f43f5e)',
        'syl-amber': 'linear-gradient(135deg,#d97706,#f59e0b)',
        'syl-orange': 'linear-gradient(135deg,#ea580c,#f97316)',
        'syl-pink': 'linear-gradient(135deg,#db2777,#ec4899)',
        'syl-teal': 'linear-gradient(135deg,#0d9488,#14b8a6)',
    };
    const gradBg = colorMap[meta.color] || 'linear-gradient(135deg,var(--accent),var(--accent-2))';

    // Build or update the box header (never duplicate)
    let existingHeader = box.querySelector('.syl-content-header');
    if (!existingHeader) {
        existingHeader = document.createElement('div');
        existingHeader.className = 'syl-content-header';
        box.insertBefore(existingHeader, content);
    }
    existingHeader.style.removeProperty('background');
    existingHeader.innerHTML = `
        <div class="syl-content-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">${innerSVG}</svg>
        </div>
        <div class="syl-content-title">
            <h3>${meta.label}</h3>
            <p>${showTranslated ? 'অনুবাদ সংস্করণ' : 'মূল সিলেবাস'}</p>
        </div>
        <span class="syl-content-badge">${showTranslated ? 'অনুবাদ' : 'Syllabus'}</span>
    `;

    // Render content
    if (showTranslated && sylData.translated) {
        content.innerHTML = sylData.translated;
        appendSylToggleBtn(content, key, false, 'মূল সিলেবাস দেখুন');
    } else {
        content.innerHTML = sylData.content;
        if (sylData.translated) {
            appendSylToggleBtn(content, key, true, 'বাংলা অনুবাদ দেখুন');
        }
    }

    // Wrap tables
    content.querySelectorAll('table').forEach(table => {
        if (!table.parentNode.classList.contains('table-wrapper') && !table.parentNode.classList.contains('table-scroll-inner')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
        const outer = table.closest('.table-wrapper');
        if (outer && !outer.querySelector('.table-scroll-inner')) {
            const inner = document.createElement('div');
            inner.className = 'table-scroll-inner';
            outer.insertBefore(inner, table);
            inner.appendChild(table);
        }
        requestAnimationFrame(() => {
            if (!outer) return;
            const inner = outer.querySelector('.table-scroll-inner');
            const scrollTarget = inner || outer;
            const update = () => {
                const has = scrollTarget.scrollWidth > scrollTarget.clientWidth;
                outer.classList.toggle('has-overflow', has && scrollTarget.scrollLeft < scrollTarget.scrollWidth - scrollTarget.clientWidth - 2);
                outer.classList.toggle('scrolled-right', scrollTarget.scrollLeft > 2);
            };
            update();
            scrollTarget.addEventListener('scroll', update, { passive: true });
        });
    });

    // Scroll into view after a brief moment
    setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function appendSylToggleBtn(container, key, showTranslated, label) {
    const btn = document.createElement('button');
    btn.className = 'syl-toggle-btn';
    btn.innerHTML = `${label}`;
    btn.onclick = () => renderSyllabusContent(key, showTranslated);
    container.appendChild(btn);
}

// --------------------------------------------------------------------------
// 9. Bookmarks Feature
// --------------------------------------------------------------------------
function toggleBookmark(event, subject, year, type, idx) {
    event.stopPropagation();
    const id = `${subject}_${year}_${type}_${idx}`;
    const bookmarkIdx = bookmarks.findIndex(b => b.id === id);

    if (bookmarkIdx > -1) {
        bookmarks.splice(bookmarkIdx, 1);
        showToast('🗑 বুকমার্ক সরানো হয়েছে', 'info');
    } else {
        const item = allData[subject]?.questions?.[year]?.[type]?.[idx];
        if (item) {
            bookmarks.push({
                id, subject, year, type, idx,
                q: item.q,
                subjectName: allData[subject]?.name,
                subjectIcon: allData[subject]?.icon || '📘'
            });
            showToast('⭐ বুকমার্ক যুক্ত হয়েছে', 'success');
        }
    }

    localStorage.setItem('bookmarks_5sem', JSON.stringify(bookmarks));
    updateBookmarkBadge();

    // Update all bookmark icons on page using data-bookmark-id
    refreshAllBookmarkIcons();

    // If bookmarks page is open, re-render
    if (!document.getElementById('bookmarks-section').classList.contains('hidden')) {
        renderBookmarksList();
    }
}

function updateBookmarkIcon(btn, subject, year, type, idx) {
    if (!btn) return;
    const id = `${subject}_${year}_${type}_${idx}`;
    const isBookmarked = bookmarks.some(b => b.id === id);
    btn.classList.toggle('bookmarked', isBookmarked);
    const svgPath = btn.querySelector('path');
    if (svgPath) {
        svgPath.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
    }
    btn.dataset.bookmarkId = id;
}

function refreshAllBookmarkIcons() {
    document.querySelectorAll('.bookmark-btn[data-bookmark-id]').forEach(btn => {
        const id = btn.dataset.bookmarkId;
        const isBookmarked = bookmarks.some(b => b.id === id);
        btn.classList.toggle('bookmarked', isBookmarked);
        const svgPath = btn.querySelector('path');
        if (svgPath) svgPath.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
    });
}

function updateBookmarkBadge() {
    ['bookmark-count-badge', 'bn-badge'].forEach(id => {
        const badge = document.getElementById(id);
        if (!badge) return;
        if (bookmarks.length > 0) {
            badge.textContent = toBengaliNum(bookmarks.length);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

function showBookmarks(fromRoute) {
    hideAllSections();
    document.getElementById('bookmarks-section').classList.remove('hidden');
    document.querySelectorAll('#subject-nav button').forEach(btn => btn.classList.remove('active'));
    currentState = { subject: null, year: null, type: null, noteCategory: null, noteSubject: null, view: 'bookmarks' };
    renderBookmarksList();
    if (fromRoute !== true) { commitView('bookmarks'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else syncBottomNav();
}

function renderBookmarksList() {
    const list = document.getElementById('bookmarks-list');

    if (bookmarks.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
                <p>এখনো কোনো প্রশ্ন সংরক্ষণ করা হয়নি।<br><small>প্রশ্নের পাশের বুকমার্ক আইকনে ক্লিক করুন।</small></p>
            </div>`;
        return;
    }

    list.innerHTML = '';
    bookmarks.forEach(b => {
        const wrap = document.createElement('div');
        wrap.className = 'q-accordion mb-3';

        const header = document.createElement('div');
        header.className = 'q-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        header.innerHTML = `
            <span class="q-num-badge bm-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg></span>
            <div class="flex-1 text-left">
                <div class="text-xs bm-meta mb-1">${b.subjectName}, ${toBengaliNum(b.year)} সাল, ${b.type === 'mcq' ? 'MCQ' : 'লিখিত'}</div>
                <div>${formatQuestionText(b.q)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.4rem">
                <button class="bookmark-btn bookmarked" onclick="removeBookmark(event,'${b.id}')" title="বুকমার্ক সরান">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
                </button>
                <div class="q-chevron">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            </div>
        `;

        const body = document.createElement('div');
        body.className = 'q-body';

        // Get actual answer
        const item = allData[b.subject]?.questions?.[b.year]?.[b.type]?.[b.idx];
        if (item) {
            if (b.type === 'written') {
                const content = document.createElement('div');
                content.className = 'answer-content';
                content.innerHTML = item.a || 'উত্তর পাওয়া যায়নি।';
                sanitizeContent(content);
                body.appendChild(content);
            } else {
                const letters = isEnglishText((item.q || '') + ' ' + (item.o || []).join(' ')) ? ['a', 'b', 'c', 'd'] : ['ক', 'খ', 'গ', 'ঘ'];
                body.innerHTML = `<div class="answer-content">
                    <p><strong>সঠিক উত্তর:</strong> ${letters[item.a]} — ${item.o?.[item.a] || ''}</p>
                    <div class="mcq-options mt-2">
                        ${(item.o || []).map((o, i) => `<div class="mcq-option ${i === item.a ? 'correct' : ''}" style="pointer-events:none">
                            <span class="opt-letter">${letters[i]}</span><span>${o}</span>
                        ${i === item.a ? `<span class="option-icon correct" style="pointer-events:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg></span>` : '<span class="option-icon"></span>'}
                        </div>`).join('')}
                    </div>
                </div>`;
            }
        }

        if (item) {
            const target = { subject: b.subject, year: String(b.year), type: b.type, idx: b.idx, qText: (item.q || '').replace(/<[^>]*>/g, '') };
            body.querySelector('.answer-content')?.appendChild(createAnswerActions(target, b.idx));
            attachShareHandlers(header, target);
        }

        wrap.appendChild(header);
        wrap.appendChild(body);
        header.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-btn')) return;
            toggleAccordion(header, body);
        });
        header.addEventListener('keydown', (e) => {
            if (e.target !== header) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAccordion(header, body); }
        });

        list.appendChild(wrap);
    });
}

function removeBookmark(event, id) {
    event.stopPropagation();
    const idx = bookmarks.findIndex(b => b.id === id);
    if (idx > -1) {
        bookmarks.splice(idx, 1);
        localStorage.setItem('bookmarks_5sem', JSON.stringify(bookmarks));
        updateBookmarkBadge();
        renderBookmarksList();
        showToast('🗑 বুকমার্ক সরানো হয়েছে', 'info');
    }
}

function setupBookmarksPage() {
    document.getElementById('clear-bookmarks-btn').onclick = () => {
        if (bookmarks.length === 0) { showToast('কোনো বুকমার্ক নেই', 'info'); return; }
        if (confirm('সব বুকমার্ক মুছে ফেলবেন?')) {
            bookmarks.length = 0;
            localStorage.removeItem('bookmarks_5sem');
            updateBookmarkBadge();
            renderBookmarksList();
            showToast('🗑 সব বুকমার্ক মুছে ফেলা হয়েছে', 'info');
        }
    };
}

// --------------------------------------------------------------------------
// 10. Home Stats
// --------------------------------------------------------------------------
function renderHomeStats() {
    const container = document.getElementById('home-stats');
    if (!container) return;

    let totalSubjects = 0, totalWritten = 0, totalMCQ = 0;

    Object.keys(allData).forEach(key => {
        if (key === 'syllabus') return;
        const subj = allData[key];
        if (!subj.questions) return;
        totalSubjects++;
        Object.keys(subj.questions).forEach(year => {
            totalWritten += (subj.questions[year].written || []).length;
            totalMCQ += (subj.questions[year].mcq || []).length;
        });
    });

    const stats = [
        { num: totalSubjects, label: 'মোট বিষয়', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>` },
        { num: totalWritten, label: 'লিখিত প্রশ্ন', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>` },
        { num: totalMCQ, label: 'MCQ প্রশ্ন', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>` },
    ];

    container.innerHTML = stats.map(s => `
        <div class="stat-item card">
            <div class="s-icon-svg">${s.svg}</div>
            <div class="s-num" data-target="${s.num}">০</div>
            <div class="s-label">${s.label}</div>
        </div>
    `).join('');

    // Count-up animation
    container.querySelectorAll('.s-num').forEach(el => {
        const target = parseInt(el.dataset.target);
        const duration = 900;
        const start = performance.now();
        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            el.textContent = toBengaliNum(Math.round(ease * target));
            if (progress < 1) requestAnimationFrame(update);
        }
        setTimeout(() => requestAnimationFrame(update), 200);
    });
}

// --------------------------------------------------------------------------
// 11. Utility Functions
// --------------------------------------------------------------------------
function hideAllSections() {
    ['intro-section', 'bookmarks-section', 'syllabus-section', 'chart-section',
     'filter-section', 'question-display', 'progress-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const display = document.getElementById('question-display');
    if (display) { display.classList.remove('hidden'); display.innerHTML = ''; }
    hideMCQScoreUI();
}

function formatQuestionText(text) {
    if (!text) return '';
    return text.replace(
        /(^(\d+|[০-৯]+)[\.।]\s*(?:\([a-zA-Zক-ৎivx]+\))?|^\([a-zA-Zক-ৎivx]+\)|^টীকা:|^(?:Or|অথবা),?:?|^Short Note:\s*\([ivx]+\)|Explain:|Marks:\s*\d+)/gm,
        '<strong>$&</strong>'
    );
}

function sanitizeContent(element) {
    element.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    element.querySelectorAll('table').forEach(table => {
        // Outer wrapper: shadow ও border-radius এখানে
        if (!table.parentNode.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
        // Inner scroll container — shadow নিরাপদ রাখার জন্য
        const outer = table.parentNode;
        if (outer && !outer.querySelector('.table-scroll-inner')) {
            const inner = document.createElement('div');
            inner.className = 'table-scroll-inner';
            outer.insertBefore(inner, table);
            inner.appendChild(table);
        }

        // has-overflow ও scrolled-right class manage করো
        requestAnimationFrame(() => {
            const inner = outer.querySelector('.table-scroll-inner');
            const scrollTarget = inner || outer;

            const updateOverflowState = () => {
                const hasOverflow = scrollTarget.scrollWidth > scrollTarget.clientWidth;
                outer.classList.toggle('has-overflow', hasOverflow && scrollTarget.scrollLeft < scrollTarget.scrollWidth - scrollTarget.clientWidth - 2);
                outer.classList.toggle('scrolled-right', scrollTarget.scrollLeft > 2);
            };

            updateOverflowState();
            scrollTarget.addEventListener('scroll', updateOverflowState, { passive: true });
            window.addEventListener('resize', updateOverflowState, { passive: true });
        });
    });
}

// --------------------------------------------------------------------------
// 12. Theme
// --------------------------------------------------------------------------
function setupThemeToggle() {
    const track = document.getElementById('theme-toggle-track');
    const thumb = document.getElementById('theme-toggle-thumb');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const meta = document.getElementById('theme-color-meta');

    function updateToggleUI() {
        const isDark = document.body.classList.contains('dark');
        track.classList.toggle('dark-mode', isDark);
        track.setAttribute('aria-checked', isDark ? 'true' : 'false');
        sunIcon.style.display = isDark ? 'none' : 'block';
        moonIcon.style.display = isDark ? 'block' : 'none';
        if (meta) meta.content = isDark ? '#06191d' : '#e6eeec';
    }

    track.addEventListener('click', () => {
        document.body.classList.add('theme-switching');
        requestAnimationFrame(() => {
            const isDark = !document.body.classList.contains('dark');
            document.body.classList.toggle('dark', isDark);
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateToggleUI();
            if (topicChart) setTimeout(renderChart, 50);
            setTimeout(() => document.body.classList.remove('theme-switching'), 50);
        });
    });

    track.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); track.click(); }
    });

    updateToggleUI();
}

function applyTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.body.classList.toggle('dark', isDark);
}

// --------------------------------------------------------------------------
// 13. FAB (Back to Top) — Smart Mobile Behavior
// --------------------------------------------------------------------------
function setupFAB() {
    const fab = document.getElementById('fab');
    const isMobile = () => window.innerWidth < 768 ||
                           ('ontouchstart' in window && window.innerWidth < 1024);

    let lastScrollY    = 0;
    let ticking        = false;
    let hideTimer      = null;
    const SHOW_THRESH  = 400;   // এর নিচে সবসময় লুকানো
    const SCROLL_DELTA = 6;     // এতটুকু scroll হলে direction detect করবে

    function updateFAB() {
        const currentY  = window.scrollY;
        const scrolled  = currentY > SHOW_THRESH;

        if (!scrolled) {
            // পেজের শুরুতে — লুকাও
            fab.classList.remove('fab-visible', 'fab-peek');
            lastScrollY = currentY;
            ticking = false;
            return;
        }

        if (isMobile()) {
            // ─── মোবাইল: স্মার্ট behavior ───
            const diff = currentY - lastScrollY;

            if (diff > SCROLL_DELTA) {
                // নিচে scroll করছে → লুকাও
                fab.classList.remove('fab-visible');
                fab.classList.add('fab-peek');   // ছোট dot হিসেবে থাকবে

                // hideTimer: স্ক্রল থামলে ৩ সেকেন্ড পরে পুরো লুকাও
                clearTimeout(hideTimer);
                hideTimer = setTimeout(() => {
                    fab.classList.remove('fab-peek');
                }, 3000);

            } else if (diff < -SCROLL_DELTA) {
                // উপরে scroll করছে → দেখাও
                clearTimeout(hideTimer);
                fab.classList.remove('fab-peek');
                fab.classList.add('fab-visible');
            }
        } else {
            // ─── Desktop: আগের মতো সহজ behavior ───
            fab.classList.remove('fab-peek');
            fab.classList.toggle('fab-visible', scrolled);
        }

        lastScrollY = currentY;
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateFAB);
            ticking = true;
        }
    }, { passive: true });

    // স্ক্রল থামার পর ১.৫ সেকেন্ড পরে মোবাইলে FAB দেখাও
    let stopTimer = null;
    window.addEventListener('scroll', () => {
        if (!isMobile()) return;
        clearTimeout(stopTimer);
        if (window.scrollY > SHOW_THRESH) {
            stopTimer = setTimeout(() => {
                fab.classList.remove('fab-peek');
                fab.classList.add('fab-visible');
            }, 1500);
        }
    }, { passive: true });
}

// --------------------------------------------------------------------------
// 14. Toast Notifications
// --------------------------------------------------------------------------
const TOAST_ICONS = {
    success: `<svg class="t-icon-svg success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    warning: `<svg class="t-icon-svg warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    error:   `<svg class="t-icon-svg error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg class="t-icon-svg info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    // Max 3 toasts at a time — remove oldest if over limit
    const existing = container.querySelectorAll('.toast:not(.out)');
    if (existing.length >= 3) {
        existing[0].classList.add('out');
        setTimeout(() => existing[0].remove(), 300);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
    // Strip emoji from message if present (leading emoji pattern)
    const cleanMsg = message.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2700}-\u{27BF}\uFE0F✅❌⭐🎉📖⏸▶🗑✓]+\s*/u, '');
    toast.innerHTML = `${icon}<span>${cleanMsg || message}</span>`;
    container.appendChild(toast);
    const duration = window.matchMedia('(pointer: coarse)').matches ? 2200 : 2800;
    setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 280);
    }, duration);
}

// --------------------------------------------------------------------------
// 15. Animations
// --------------------------------------------------------------------------
const animObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.04, rootMargin: '0px 0px -20px 0px' });

function applyScrollAnimation(selector) {
    const els = typeof selector === 'string' ? document.querySelectorAll(selector) : [selector];
    els.forEach((el, i) => {
        el.classList.add('reveal-on-scroll');
        el.style.transitionDelay = `${Math.min(i * 0.035, 0.2)}s`;
        animObserver.observe(el);
    });
}

// --------------------------------------------------------------------------
// 18. Font Size System
// --------------------------------------------------------------------------
const FS_PRESETS = ['fs-normal', 'fs-large', 'fs-xlarge'];
const FS_LABELS  = ['A', 'A+', 'A++'];
let fsIndex = 0;

function initFontSize() {
    const saved = localStorage.getItem('fontSize') || 'fs-normal';
    fsIndex = FS_PRESETS.indexOf(saved);
    if (fsIndex < 0) fsIndex = 0;
    applyFontSize();

    document.getElementById('font-size-btn').addEventListener('click', () => {
        fsIndex = (fsIndex + 1) % FS_PRESETS.length;
        applyFontSize();
        localStorage.setItem('fontSize', FS_PRESETS[fsIndex]);
        showToast(`ফন্ট সাইজ: <strong>${FS_LABELS[fsIndex]}</strong>`);
    });
}

function applyFontSize() {
    FS_PRESETS.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(FS_PRESETS[fsIndex]);
    document.getElementById('fs-label').textContent = FS_LABELS[fsIndex];
}

// --------------------------------------------------------------------------
// 19. Context Menu Share System
// --------------------------------------------------------------------------
let ctxMenu, ctxTarget = null, ctxOpenedAt = 0;

const isPhoneLayout = () => window.matchMedia('(max-width: 640px), (pointer: coarse) and (max-width: 900px)').matches;

function initContextMenu() {
    ctxMenu = document.getElementById('ctx-menu');
    const backdrop = document.getElementById('share-backdrop');

    // Native share sheet exists only on secure origins (https / localhost)
    if (navigator.share) document.getElementById('ctx-native-share').style.display = '';

    // Close on outside click, Escape, resize, or a real scroll on desktop
    document.addEventListener('click', (e) => {
        if (!ctxMenu.classList.contains('open')) return;
        if (ctxMenu.contains(e.target)) return;
        if (Date.now() - ctxOpenedAt < 350) return;
        closeCtxMenu();
    });
    backdrop.addEventListener('click', () => closeCtxMenu());
    window.addEventListener('resize', () => closeCtxMenu());
    window.addEventListener('scroll', () => {
        if (ctxMenu.classList.contains('open') && !ctxMenu.classList.contains('as-sheet') && Date.now() - ctxOpenedAt > 400) closeCtxMenu();
    }, { passive: true });
    document.getElementById('ctx-close').addEventListener('click', () => closeCtxMenu());

    // swipe the sheet down to dismiss
    let startY = null;
    ctxMenu.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    ctxMenu.addEventListener('touchmove', (e) => {
        if (startY === null || !ctxMenu.classList.contains('as-sheet')) return;
        const dy = Math.max(0, e.touches[0].clientY - startY);
        ctxMenu.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    ctxMenu.addEventListener('touchend', (e) => {
        if (startY === null) return;
        const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
        ctxMenu.style.transform = '';
        startY = null;
        if (ctxMenu.classList.contains('as-sheet') && dy > 70) closeCtxMenu();
    });

    const run = (fn) => () => { if (!ctxTarget) return; const t = ctxTarget; closeCtxMenu(); fn(t); };

    document.getElementById('ctx-copy-link').addEventListener('click', run(t =>
        copyText(buildShareURL(t), '✅ প্রশ্নের লিংক কপি হয়েছে!')));

    document.getElementById('ctx-copy-text').addEventListener('click', run(t =>
        copyText(shareHeadline(t), '✅ প্রশ্ন কপি হয়েছে!')));

    document.getElementById('ctx-copy-full').addEventListener('click', run(t =>
        copyText(shareFullText(t), t.type === 'mcq' ? '✅ প্রশ্ন, অপশন ও উত্তর কপি হয়েছে!' : '✅ প্রশ্ন ও উত্তর কপি হয়েছে!')));

    document.getElementById('ctx-whatsapp').addEventListener('click', run(t => {
        const msg = encodeURIComponent(`${shareHeadline(t)}\n\n${buildShareURL(t)}`);
        openExternal(`https://wa.me/?text=${msg}`);
    }));

    document.getElementById('ctx-telegram').addEventListener('click', run(t => {
        openExternal(`https://t.me/share/url?url=${encodeURIComponent(buildShareURL(t))}&text=${encodeURIComponent(shareHeadline(t))}`);
    }));

    document.getElementById('ctx-messenger').addEventListener('click', run(t => {
        const url = buildShareURL(t);
        if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
            // Messenger app deep link; falls back to copying the link if the app is missing
            copyText(`${shareHeadline(t)}\n${url}`, '📋 লিংক কপি হয়েছে — Messenger-এ পেস্ট করুন', true);
            window.location.href = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
        } else {
            openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        }
    }));

    document.getElementById('ctx-native-share').addEventListener('click', run(t => {
        navigator.share({ title: '৫ম সেমিস্টার প্রশ্নোত্তর', text: shareHeadline(t), url: buildShareURL(t) })
            .catch(err => { if (err && err.name !== 'AbortError') copyText(buildShareURL(t), '✅ লিংক কপি হয়েছে!'); });
    }));
}

function openExternal(url) {
    const w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
}

// Clipboard that also works on plain-http (e.g. Live Server over Wi-Fi on a phone)
function copyText(text, okMsg, silent) {
    const done = () => { if (okMsg) showToast(okMsg); };
    const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) {}
        ta.remove();
        if (ok) done(); else if (!silent) showToast('⚠️ কপি করা যায়নি, আবার চেষ্টা করুন');
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
    } else {
        fallback();
    }
}

function htmlToPlain(html) {
    const div = document.createElement('div');
    div.innerHTML = (html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|h[1-6]|li|tr|div|table|ul|ol)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/t[dh]>/gi, '\t');
    return div.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function shareItem(t) {
    return allData[t.subject]?.questions?.[t.year]?.[t.type]?.[t.idx] || null;
}

function shareHeadline(t) {
    const subj = allData[t.subject]?.name || '';
    const q = htmlToPlain(shareItem(t)?.q || t.qText).replace(/^([০-৯\d]+)[।.)\s]+/, '');
    const kind = t.type === 'mcq' ? 'MCQ' : 'প্রশ্ন';
    return `📘 ${subj} — ${toBengaliNum(t.year)} সাল, ${kind} ${toBengaliNum(t.idx + 1)}\n${q}`;
}

function shareFullText(t) {
    const item = shareItem(t);
    if (!item) return shareHeadline(t);
    let body = '';
    if (t.type === 'mcq') {
        const isEn = isEnglishText((item.q || '') + ' ' + (item.o || []).join(' '));
        const L = isEn ? ['a', 'b', 'c', 'd'] : ['ক', 'খ', 'গ', 'ঘ'];
        body = (item.o || []).map((o, i) => `${L[i]}) ${htmlToPlain(o)}`).join('\n') +
               `\n\n✅ সঠিক উত্তর: ${L[item.a]}) ${htmlToPlain(item.o?.[item.a])}`;
    } else {
        body = '✍️ উত্তর:\n' + htmlToPlain(item.a);
    }
    return `${shareHeadline(t)}\n\n${body}\n\n🔗 ${buildShareURL(t)}`;
}

function buildShareURL(target) {
    const base = window.location.href.split('#')[0];
    const params = new URLSearchParams();
    params.set('subject', target.subject);
    params.set('year', target.year);
    params.set('type', target.type);
    if (Number.isInteger(target.idx)) params.set('q', String(target.idx + 1));
    return `${base}#${params.toString()}`;
}

function openCtxMenu(e, target) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (ctxMenu.classList.contains('open') && Date.now() - ctxOpenedAt < 600) return; // long-press + contextmenu fire together on Android
    ctxTarget = target;
    ctxOpenedAt = Date.now();

    const kind = target.type === 'mcq' ? 'MCQ' : 'প্রশ্ন';
    document.getElementById('ctx-kicker').textContent = `${allData[target.subject]?.name || ''} · ${toBengaliNum(target.year)} · ${kind} ${toBengaliNum(target.idx + 1)}`;
    const plain = (target.qText || '').replace(/^([০-৯\d]+)[।.)\s]+/, '').trim();
    document.getElementById('ctx-q-label').textContent = plain.length > 90 ? plain.substring(0, 90) + '…' : plain;
    document.getElementById('ctx-copy-full-label').textContent = target.type === 'mcq' ? 'প্রশ্ন, অপশন ও উত্তর কপি করুন' : 'প্রশ্ন ও উত্তর কপি করুন';

    const sheet = isPhoneLayout();
    ctxMenu.classList.toggle('as-sheet', sheet);
    ctxMenu.style.transform = '';
    if (sheet) {
        ctxMenu.style.left = ''; ctxMenu.style.top = '';
        document.getElementById('share-backdrop').classList.add('open');
        document.documentElement.classList.add('sheet-lock');
        Overlay.opened('share', () => closeCtxMenu(true));
    } else {
        ctxMenu.classList.add('measuring');
        const menuW = ctxMenu.offsetWidth || 300, menuH = ctxMenu.offsetHeight || 320;
        ctxMenu.classList.remove('measuring');
        let x = e?.clientX ?? (e?.touches?.[0]?.clientX ?? window.innerWidth / 2);
        let y = e?.clientY ?? (e?.touches?.[0]?.clientY ?? window.innerHeight / 2);
        if (e?.anchorRect) {
            x = e.anchorRect.left;
            y = e.anchorRect.top - menuH - 10;
            if (y < 70) y = e.anchorRect.bottom + 10;
        }
        x = Math.max(8, Math.min(x, window.innerWidth - menuW - 8));
        y = Math.max(8, Math.min(y, window.innerHeight - menuH - 8));
        ctxMenu.style.left = x + 'px';
        ctxMenu.style.top = y + 'px';
    }
    ctxMenu.classList.add('open');
}

function closeCtxMenu(fromHistory) {
    if (!ctxMenu?.classList.contains('open')) return;
    ctxMenu.classList.remove('open');
    ctxMenu.style.transform = '';
    document.getElementById('share-backdrop')?.classList.remove('open');
    document.documentElement.classList.remove('sheet-lock');
    if (!fromHistory) Overlay.closedByUI('share');
}

// Long-press (touch) or right-click opens the share sheet
function attachShareHandlers(el, target) {
    let pressTimer = null, sx = 0, sy = 0;
    el.addEventListener('contextmenu', (e) => openCtxMenu(e, target));
    el.addEventListener('touchstart', (e) => {
        sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => { if (navigator.vibrate) navigator.vibrate(12); openCtxMenu({ clientX: sx, clientY: sy }, target); }, 520);
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) clearTimeout(pressTimer);
    }, { passive: true });
    el.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
    el.addEventListener('touchcancel', () => clearTimeout(pressTimer), { passive: true });
}

// --------------------------------------------------------------------------
// 19b. Overlay history — Android back button closes sheets instead of leaving
// --------------------------------------------------------------------------
const Overlay = {
    stack: [],
    backPending: false,
    pendingURL: null,
    opened(name, closeFn) {
        if (this.stack.some(o => o.name === name)) return;
        this.stack.push({ name, closeFn });
        history.pushState({ ov: name }, '', window.location.href);
    },
    closedByUI(name) {
        const i = this.stack.findIndex(o => o.name === name);
        if (i === -1) return;
        this.stack.splice(i, 1);
        if (history.state && history.state.ov === name) {
            this.backPending = true;
            history.back();
        }
    },
    closeTop() {
        const top = this.stack.pop();
        if (!top) return false;
        top.closeFn();
        return true;
    }
};

function routeURL(hashStr) {
    return window.location.pathname + window.location.search + (hashStr ? '#' + hashStr : '');
}

function commitURL(hashStr, push) {
    if (Overlay.backPending) { Overlay.pendingURL = { hashStr, push }; return; }
    const cur = window.location.hash.replace(/^#/, '');
    if (cur === hashStr) return;
    if (push) history.pushState({ v: 1 }, '', routeURL(hashStr));
    else history.replaceState({ v: 1 }, '', routeURL(hashStr));
}

window.addEventListener('popstate', () => {
    if (Overlay.backPending) {
        Overlay.backPending = false;
        const p = Overlay.pendingURL; Overlay.pendingURL = null;
        if (p) commitURL(p.hashStr, p.push);
        return;
    }
    if (Overlay.closeTop()) return;
    handleHashChange();
});

// Create rich answer action row (share + read done + print)
function createAnswerActions(target, idx) {
    const row = document.createElement('div');
    row.className = 'answer-actions';

    // Read done toggle
    const readId = `read_${target.subject}_${target.year}_${target.type}_${idx}`;
    const isRead = localStorage.getItem(readId) === '1';

    const readBtn = document.createElement('button');
    readBtn.className = `action-btn${isRead ? ' read-done' : ''}`;
    readBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${isRead ? 'পড়া হয়েছে ✓' : 'পড়া হয়েছে'}
    `;
    readBtn.onclick = (e) => {
        e.stopPropagation();
        const done = localStorage.getItem(readId) === '1';
        if (done) {
            localStorage.removeItem(readId);
            readBtn.classList.remove('read-done');
            readBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> পড়া হয়েছে`;
        } else {
            localStorage.setItem(readId, '1');
            readBtn.classList.add('read-done');
            readBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> পড়া হয়েছে ✓`;
            showToast('✅ পড়া হিসেবে চিহ্নিত হয়েছে!');
        }
        updateReadingProgress();
    };

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn';
    shareBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
        শেয়ার
    `;
    shareBtn.onclick = (e) => {
        e.stopPropagation();
        openCtxMenu({ anchorRect: shareBtn.getBoundingClientRect() }, target);
    };

    // Print button
    const printBtn = document.createElement('button');
    printBtn.className = 'action-btn';
    printBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>
        প্রিন্ট
    `;
    printBtn.onclick = (e) => {
        e.stopPropagation();
        printQuestion(target);
    };

    row.appendChild(readBtn);
    row.appendChild(shareBtn);
    row.appendChild(printBtn);
    row.appendChild(createCollapseBtn());
    return row;
}

// "Fold this answer" button at the end of every answer
function createCollapseBtn() {
    const btn = document.createElement('button');
    btn.className = 'action-btn action-collapse';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg> বন্ধ করুন`;
    btn.onclick = (e) => {
        e.stopPropagation();
        const acc = btn.closest('.q-accordion');
        const header = acc?.querySelector(':scope > .q-header');
        const body = acc?.querySelector(':scope > .q-body');
        if (header && body?.classList.contains('open')) toggleAccordion(header, body);
    };
    return btn;
}

// Print a single question
function printQuestion(target) {
    const subjectData = allData[target.subject];
    const item = subjectData?.questions?.[target.year]?.[target.type]?.[target.idx];
    if (!item) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>প্রশ্ন</title>
    <style>body{font-family:sans-serif;max-width:720px;margin:2rem auto;padding:1rem;color:#333;line-height:1.8}
    h2{font-size:1.1rem;border-bottom:2px solid #0a7f6f;padding-bottom:.5rem;color:#0a7f6f}
    .q{font-weight:700;font-size:1rem;margin-bottom:1rem;padding:.75rem;background:#eef6f4;border-radius:8px}
    .a{font-size:.95rem}strong{color:#0a7f6f}table{border-collapse:collapse;width:100%}th{background:#0a7f6f;color:#fff;padding:.5rem}td{padding:.4rem;border:1px solid #ccc}
    footer{margin-top:2rem;font-size:.75rem;color:#999;border-top:1px solid #eee;padding-top:.5rem}</style></head><body>
    <h2>${subjectData.icon || ''} ${subjectData.name} — ${target.year}</h2>
    <div class="q">${item.q}</div>
    <div class="a">${item.a || 'উত্তর পাওয়া যায়নি।'}</div>
    <footer>৫ম সেমিস্টার প্রশ্নোত্তর সংকলন — Govt. Teachers' Training College, Faridpur</footer>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
}

// --------------------------------------------------------------------------
// 20. Scroll Progress Bar
// --------------------------------------------------------------------------
function initScrollProgressBar() {
    const bar = document.getElementById('scroll-progress-bar');
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (scrolled / max) * 100 : 0;
        bar.style.width = pct + '%';
    }, { passive: true });
}

// --------------------------------------------------------------------------
// 21. Study Timer — Dynamic Now-Bar (Score/Timer switching)
// --------------------------------------------------------------------------
let timerInterval = null, timerSeconds = 0, timerPaused = false;

// Track whether MCQ score section is visible in viewport
let mcqScoreVisible = true;      // true = score-wrap visible → show timer in pill
let pillShowScore = false;        // pill is currently in score-mode
let mcqActive = false;            // MCQ mode is active at all

// Swipe tracking
let swipeTouchStartX = 0, swipeTouchStartY = 0;

function initStudyTimer() {
    const timerEl = document.getElementById('study-timer');
    const display = document.getElementById('timer-display');

    // Start counting
    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerSeconds++;
            display.textContent = formatTime(timerSeconds);
        }
    }, 1000);

    // Click: pause/resume (only when showing timer), or toggle when showing score
    timerEl.addEventListener('click', (e) => {
        if (pillShowScore) {
            // Tap on score pill → switch to timer briefly, then auto-switch back? No — just toggle manually
            switchPillMode('timer');
        } else {
            timerPaused = !timerPaused;
            timerEl.classList.toggle('paused', timerPaused);
            showToast(timerPaused ? '⏸ টাইমার থামানো হয়েছে' : '▶ টাইমার চলছে');
        }
    });

    // ── Swipe gesture (mobile & desktop) ──
    timerEl.addEventListener('touchstart', (e) => {
        swipeTouchStartX = e.touches[0].clientX;
        swipeTouchStartY = e.touches[0].clientY;
    }, { passive: true });

    timerEl.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - swipeTouchStartX;
        const dy = e.changedTouches[0].clientY - swipeTouchStartY;
        // Swipe threshold: 30px, must be primarily horizontal or vertical
        if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
            if (mcqActive) {
                // Any swipe direction toggles score/timer in pill
                togglePillModeManual();
            }
        }
    }, { passive: true });

    // Mouse wheel / trackpad swipe on pill
    timerEl.addEventListener('wheel', (e) => {
        if (!mcqActive) return;
        e.preventDefault();
        togglePillModeManual();
    }, { passive: false });

    // ── IntersectionObserver: watch MCQ score wrap — set up lazily ──
    // We observe it when it becomes visible (MCQ mode activated), not at init
    const scoreWrapObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            mcqScoreVisible = entry.isIntersecting;
            if (mcqActive) {
                if (!mcqScoreVisible) {
                    switchPillMode('score');
                } else {
                    switchPillMode('timer');
                }
            }
        });
    }, { threshold: 0.1 });

    // Store observer reference for use when MCQ mode activates
    window._scoreWrapObs = scoreWrapObs;
}

function switchPillMode(mode, skipAnim) {
    const timerEl = document.getElementById('study-timer');
    if (mode === 'score') {
        if (!pillShowScore) {
            pillShowScore = true;
            timerEl.classList.add('show-score');
            if (!skipAnim) {
                timerEl.classList.add('score-mode-entering');
                setTimeout(() => timerEl.classList.remove('score-mode-entering'), 450);
            }
        }
    } else {
        if (pillShowScore) {
            pillShowScore = false;
            timerEl.classList.remove('show-score');
            if (!skipAnim) {
                timerEl.classList.add('score-mode-entering');
                setTimeout(() => timerEl.classList.remove('score-mode-entering'), 450);
            }
        }
    }
}

// Manual toggle by swipe
let lastManualToggle = 0;
function togglePillModeManual() {
    const now = Date.now();
    if (now - lastManualToggle < 400) return; // debounce
    lastManualToggle = now;
    switchPillMode(pillShowScore ? 'timer' : 'score');
}

// Called when MCQ practice starts
function activateMCQPillMode() {
    mcqActive = true;
    const scoreWrap = document.getElementById('mcq-score-wrap');
    if (scoreWrap && window._scoreWrapObs) {
        window._scoreWrapObs.disconnect();
        window._scoreWrapObs.observe(scoreWrap);
    }
    // Initially, if score wrap is not visible, show score in pill
    const rect = scoreWrap?.getBoundingClientRect();
    mcqScoreVisible = rect ? (rect.top >= 0 && rect.bottom <= window.innerHeight) : false;
    if (!mcqScoreVisible) {
        switchPillMode('score', true);
    }
}

// Called when leaving MCQ mode
function deactivateMCQPillMode() {
    mcqActive = false;
    window._scoreWrapObs?.disconnect();
    switchPillMode('timer', true);
}

// Update pill score display
function updatePillScore(score, total) {
    const pillScore = document.getElementById('pill-score');
    const pillTotal = document.getElementById('pill-total');
    if (!pillScore || !pillTotal) return;

    const oldScore = pillScore.textContent;
    pillScore.textContent = score;
    pillTotal.textContent = total;

    if (String(score) !== oldScore && mcqActive) {
        // Flash animation on score change
        pillScore.classList.remove('updated');
        void pillScore.offsetWidth;
        pillScore.classList.add('updated');
        setTimeout(() => pillScore.classList.remove('updated'), 500);

        // Dot color = green if good, rose if poor
        const pct = total > 0 ? score / total : 0;
        const dot = document.querySelector('#study-timer .timer-dot');
        if (dot) {
            dot.style.background = pct >= 0.7 ? 'var(--accent-4)' : pct >= 0.4 ? 'var(--accent-warm)' : 'var(--accent-rose)';
            dot.style.boxShadow = pct >= 0.7 ? '0 0 8px rgba(16,185,129,0.8)' : pct >= 0.4 ? '0 0 8px rgba(245,158,11,0.8)' : '0 0 8px rgba(244,63,94,0.8)';
        }
    }
}

function formatTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// --------------------------------------------------------------------------
// 22. Keyboard Shortcuts
// --------------------------------------------------------------------------
function initKeyboardShortcuts() {
    const panel = document.getElementById('shortcut-panel');
    const closeBtn = document.getElementById('close-shortcut-panel');
    const helpBtn = document.getElementById('shortcut-help-btn');

    // মোবাইল/টাচ ডিভাইসে shortcut panel দরকার নেই
    const isDesktop = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (helpBtn) helpBtn.onclick = () => { if (isDesktop()) panel.classList.add('open'); };
    if (closeBtn) closeBtn.onclick = () => panel.classList.remove('open');
    panel?.addEventListener('click', (e) => { if (e.target === panel) panel.classList.remove('open'); });

    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.matches('input, textarea, select')) {
            if (e.key === 'Escape') e.target.blur();
            return;
        }

        if (e.key === '?' || (e.key === '/' && !e.ctrlKey)) {
            e.preventDefault();
            if (isDesktop()) panel.classList.toggle('open');
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('global-search')?.focus();
        } else if (e.key === 'Escape') {
            if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
            if (document.getElementById('ctx-menu')?.classList.contains('open')) { closeCtxMenu(); return; }
            showHomePage();
        } else if (e.key === 'd' || e.key === 'D') {
            document.getElementById('theme-toggle-track')?.click();
        } else if (e.key === 'f' || e.key === 'F') {
            document.getElementById('font-size-btn')?.click();
        } else if (e.key === 'ArrowRight' || (e.key === 'j' && !e.ctrlKey && !e.metaKey)) {
            navigateQuestion(1);
        } else if (e.key === 'ArrowLeft' || (e.key === 'k' && !e.ctrlKey && !e.metaKey)) {
            navigateQuestion(-1);
        }
    });
}

function navigateQuestion(dir) {
    const accordions = Array.from(document.querySelectorAll('#question-display .q-accordion'));
    if (accordions.length === 0) return;
    const activeIdx = accordions.findIndex(a => a.querySelector('.q-header.active'));
    let nextIdx = activeIdx + dir;
    if (nextIdx < 0) nextIdx = accordions.length - 1;
    if (nextIdx >= accordions.length) nextIdx = 0;
    const header = accordions[nextIdx].querySelector('.q-header');
    const body = accordions[nextIdx].querySelector('.q-body');
    if (!header || !body) return;
    toggleAccordion(header, body, { noScroll: true });
    const top = header.getBoundingClientRect().top + window.scrollY - getStickyOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// 23. Reading Progress Tracker
// --------------------------------------------------------------------------
function updateReadingProgress() {
    const { subject, year, type } = currentState;
    if (!subject || !year || !type) return;

    const questions = allData[subject]?.questions?.[year]?.[type] || [];
    if (questions.length === 0) return;

    const readCount = questions.filter((_, i) => {
        return localStorage.getItem(`read_${subject}_${year}_${type}_${i}`) === '1';
    }).length;

    const bar = document.querySelector('.read-progress-bar-fill');
    const label = document.querySelector('.read-progress-label');
    if (bar) bar.style.width = `${(readCount / questions.length) * 100}%`;
    if (label) label.textContent = `${toBengaliNum(readCount)}/${toBengaliNum(questions.length)} পড়া হয়েছে`;
}

function renderReadingProgressBar() {
    const { subject, year, type } = currentState;
    const questions = allData[subject]?.questions?.[year]?.[type] || [];
    const readCount = questions.filter((_, i) =>
        localStorage.getItem(`read_${subject}_${year}_${type}_${i}`) === '1'
    ).length;

    const wrap = document.createElement('div');
    wrap.className = 'read-progress-wrap mb-3';
    wrap.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-4);flex-shrink:0"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <div class="read-progress-bar-track"><div class="read-progress-bar-fill" style="width:${questions.length > 0 ? (readCount/questions.length*100) : 0}%"></div></div>
        <span class="read-progress-label">${toBengaliNum(readCount)}/${toBengaliNum(questions.length)} পড়া হয়েছে</span>
    `;
    return wrap;
}

// --------------------------------------------------------------------------
// 24. Ripple Effect on Buttons
// --------------------------------------------------------------------------
function addRippleToButtons() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.neu-btn');
        if (!btn || btn.classList.contains('active')) return;
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        const rect = btn.getBoundingClientRect();
        ripple.style.left = (e.clientX - rect.left) + 'px';
        ripple.style.top = (e.clientY - rect.top) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    });
}
function selectNoteSubject(noteSubjectKey) {
    currentState.noteSubject = noteSubjectKey;
    document.querySelectorAll('#classnotes-filters button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.key === noteSubjectKey);
    });
    renderNotes();
    updateHashFromState();
}

function renderNotes() {
    const display = document.getElementById('question-display');
    display.innerHTML = '';
    const { subject, noteSubject } = currentState;
    if (!subject || !noteSubject) return;

    const notes = allData[subject].subjects?.[noteSubject] || [];
    if (notes.length === 0) {
        display.innerHTML = `<div class="no-results card p-8"><svg class="nr-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><p>এই বিষয়ের নোট পাওয়া যায়নি।</p></div>`;
        return;
    }

    notes.forEach((note, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'q-accordion mb-3 reveal-on-scroll';

        const header = document.createElement('div');
        header.className = 'q-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        header.innerHTML = `
            <span class="q-num-badge">${isEnglishText(note.title) ? idx + 1 : toBengaliNum(idx + 1)}</span>
            <div class="flex-1 text-left">
                <div>${note.title}</div>
                ${(note.date || note.instructor || note.unit) ? `<div class="note-meta">
                    ${note.unit ? `<span class="nm-chip nm-unit">${note.unit}</span>` : ''}
                    ${note.date ? `<span class="nm-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${note.date}</span>` : ''}
                    ${note.instructor ? `<span class="nm-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Instructor: ${note.instructor}</span>` : ''}
                </div>` : ''}
            </div>
            <div class="q-chevron">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
        `;

        const body = document.createElement('div');
        body.className = 'q-body';
        const content = document.createElement('div');
        content.className = 'answer-content';
        content.innerHTML = note.content;
        sanitizeContent(content);
        const row = document.createElement('div');
        row.className = 'answer-actions';
        row.appendChild(createCollapseBtn());
        content.appendChild(row);
        body.appendChild(content);

        wrap.appendChild(header);
        wrap.appendChild(body);
        header.addEventListener('click', () => toggleAccordion(header, body));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAccordion(header, body); }
        });

        display.appendChild(wrap);
    });

    setTimeout(() => applyScrollAnimation('#question-display .q-accordion'), 50);
}

// --------------------------------------------------------------------------
// 17. URL Routing
// --------------------------------------------------------------------------
function updateHashFromState() {
    const { subject, year, type } = currentState;
    const params = new URLSearchParams();
    if (subject) {
        params.append('subject', subject);
        if (year) params.append('year', year);
        if (type) params.append('type', type);
        if (currentState.noteSubject && allData[subject]?.isNoteCategory) params.append('noteSubject', currentState.noteSubject);
    }
    const next = params.toString();
    // a new screen (another subject / home) becomes a history step; year/type changes replace it
    commitURL(next, screenKey(window.location.hash) !== screenKey(next));
    syncBottomNav();
}

function screenKey(hashStr) {
    const p = new URLSearchParams(String(hashStr || '').replace(/^#/, ''));
    return p.get('subject') || p.get('view') || '';
}

function commitView(view) {
    const next = 'view=' + view;
    commitURL(next, screenKey(window.location.hash) !== view);
    syncBottomNav();
}

function handleHashChange(isInitial) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const subject = params.get('subject');
    const year = params.get('year');
    const type = params.get('type');
    const qNum = parseInt(params.get('q'), 10);
    const view = params.get('view');
    closeCtxMenu(true);
    closeReadingBar();
    if (!subject && view === 'bookmarks') { showBookmarks(true); return; }
    if (!subject && view === 'syllabus') { showSyllabus(true); syncBottomNav(); return; }

    if (subject && allData[subject]) {
        const subjectData = allData[subject];

        if (subjectData.isNoteCategory) {
            selectSubject(subject);
            const ns = params.get('noteSubject');
            if (ns) selectNoteSubject(ns);
            return;
        }

        currentState.subject = subject;
        currentState.year = year || String(subjectData.years[0]);
        const available = subjectData.questions?.[currentState.year] || {};
        const defaultType = available.written?.length ? 'written' : 'mcq';
        currentState.type = type || defaultType;

        hideAllSections();
        document.getElementById('filter-section').classList.remove('hidden');
        document.querySelectorAll('#subject-nav button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subject === subject);
        });

        if (subjectData.analysis?.data?.length > 0) {
            document.getElementById('chart-section').classList.remove('hidden');
            renderChart();
        }

        renderFilters();
        renderQuestions(qNum > 0 ? () => focusQuestion(qNum - 1) : null);
        syncBottomNav();
        if (!isInitial && !(qNum > 0)) window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
        showHomePage(true);
    }
}

// Open + highlight one question (used by shared links)
function focusQuestion(idx) {
    const display = document.getElementById('question-display');
    const items = display.querySelectorAll(currentState.type === 'mcq' ? '.mcq-card' : '.q-accordion');
    const el = items[idx];
    if (!el) return;
    el.classList.add('is-visible');
    if (currentState.type !== 'mcq') {
        const header = el.querySelector('.q-header');
        const body = el.querySelector('.q-body');
        if (header && body && !body.classList.contains('open')) toggleAccordion(header, body, { noScroll: true });
    }
    setTimeout(() => {
        const top = el.getBoundingClientRect().top + window.scrollY - getStickyOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        el.classList.add('flash-target');
        setTimeout(() => el.classList.remove('flash-target'), 2200);
    }, 120);
}
