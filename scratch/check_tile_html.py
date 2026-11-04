from bs4 import BeautifulSoup

with open('scratch/listing_117112383.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f.read(), 'html.parser')

print("Single listing price:", soup.find('div', class_='p24_price'))

