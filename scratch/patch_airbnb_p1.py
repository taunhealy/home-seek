with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add CaretDown to imports
if 'CaretDown' not in text:
    text = text.replace('Compass,', 'Compass,\n  CaretDown,')

# Add showArchiveDropdown state
if 'showArchiveDropdown' not in text:
    state_target = 'const [hideUnavailable, setHideUnavailable] = useState(false);'
    state_replacement = '''const [hideUnavailable, setHideUnavailable] = useState(false);
  const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);'''
    text = text.replace(state_target, state_replacement)

# Update main container tag to allow full-width when viewMode is split
main_target = '<main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10">'
main_replacement = '<main className={`flex-1 w-full mx-auto px-4 sm:px-6 py-8 space-y-8 transition-all ${viewMode === \'split\' ? \'max-w-[1920px] lg:px-8\' : \'max-w-6xl\'}`}>\n'
text = text.replace(main_target, main_replacement)

with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Phase 1 applied')

