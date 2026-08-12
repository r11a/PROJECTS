UPDATE projects
SET address = btrim(regexp_replace(regexp_replace(address, '[؀-ۿ]+', '', 'g'), '\s*,\s*,+', ', ', 'g'), ' ,')
WHERE address ~ '[؀-ۿ]';

UPDATE clients
SET address = btrim(regexp_replace(regexp_replace(address, '[؀-ۿ]+', '', 'g'), '\s*,\s*,+', ', ', 'g'), ' ,'),
    city = btrim(regexp_replace(city, '[؀-ۿ]+', '', 'g'), ' ,')
WHERE address ~ '[؀-ۿ]' OR city ~ '[؀-ۿ]';

UPDATE professionals
SET address = btrim(regexp_replace(regexp_replace(address, '[؀-ۿ]+', '', 'g'), '\s*,\s*,+', ', ', 'g'), ' ,')
WHERE address ~ '[؀-ۿ]';
