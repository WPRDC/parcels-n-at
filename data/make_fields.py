import csv
import json

data = {}

with open('fields.csv') as f:
    dr = csv.DictReader(f)
    for row in dr:
        r = row['resource'] 
        d = {'name': row['name'],
             'title': row['title'],
             'description': row['description'].replace('\n', ' ').replace('\r','')}
    
        if r not in data:
            data[r] = [d]
        else:
            data[r].append(d)
            
print(json.dumps(data))
