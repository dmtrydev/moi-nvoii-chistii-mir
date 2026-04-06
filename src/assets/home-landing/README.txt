Папка: src/assets/home-landing/

--- Логотип в шапке главной ---
Файл: nav-logo.svg
Путь: src/assets/home-landing/nav-logo.svg
Подмените файл своим логотипом (лучше SVG). Высота блока под лого ~44px, ширина до ~180px (object-contain, выравнивание влево).

Если только PNG: сохраните как nav-logo.png и в TopNavigationSection.tsx замените строку импорта на:
  import navLogo from '@/assets/home-landing/nav-logo.png';

--- Верхняя навигация (иконки пунктов меню) ---
nav-upload.svg
nav-directory.svg
nav-account.svg

--- Блок фильтров ---
filter-section-title-icon.svg
filter-search-icon.svg
filter-reset-icon.svg

--- Кнопка «Найти» (иконка лупы; три состояния в макете Framer) ---
Сейчас в коде используется один файл: filter-search-icon.svg

Если из Figma три разных SVG (как vector / image / vector-2), именуйте так:
  find-button-search-default.svg   — обычное состояние (было vector.svg)
  find-button-search-hover.svg    — наведение (было image.svg)
  find-button-search-pressed.svg  — нажатие (было vector-2.svg)

Альтернатива короче: find-search-icon-default.svg, find-search-icon-hover.svg, find-search-icon-pressed.svg
Градиенты кнопки уже заданы в CSS (.home-find-button); отдельные иконки нужны только если контур/заливка в макете реально отличаются.
vid-chevron-closed.svg   (серый треугольник, закрытый «Вид обращения»)
vid-chevron-open.svg     (тёмный #2b3335, открытый список)
Чекбоксы строк «Вид обращения» — src/components/home-landing/VidMenuCheckbox.tsx

--- Фон главной ---
hero-background.png

--- Старые экспорты (не используются в коде) ---
legacy-export-*.svg
