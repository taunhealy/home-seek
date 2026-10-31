with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

bad = '''        ) : (
          {/* Airbnb-style Top Control & Report Selector Bar */}
          <div className="space-y-6">'''

good = '''        ) : (
          <div className="space-y-6">
            {/* Airbnb-style Top Control & Report Selector Bar */}'''

text = text.replace(bad, good, 1)

with open('c:/Ryoko/Projects/home-seek/web/src/app/reports/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed comment syntax in reports page')

