with open('c:/Ryoko/Projects/home-seek/api/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

bad1 = 'all_ids = re.findall(r\'https://images\\.prop24\\.com/(\\d+)/[^\\s"\'<>]+\', html)'
good1 = 'all_ids = re.findall(r"""https://images\\.prop24\\.com/(\\d+)/[^\\s"\'<>]+""", html)'

bad2 = 'agent_pids.update(re.findall(r\'https://images\\.prop24\\.com/(\\d+)/[^\\s"\'<>]*(?:UpperCrop|Fit450|Fit200|Fit150|Crop200x200)\', html))'
good2 = 'agent_pids.update(re.findall(r"""https://images\\.prop24\\.com/(\\d+)/[^\\s"\'<>]*(?:UpperCrop|Fit450|Fit200|Fit150|Crop200x200)""", html))'

text = text.replace(bad1, good1).replace(bad2, good2)
with open('c:/Ryoko/Projects/home-seek/api/main.py', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed quotes in main.py')

