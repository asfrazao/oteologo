
# Projeto O Teólogo

Este projeto é uma plataforma de debates teológicos online.

## Funcionalidades

- Criação e entrada em salas de debate (fixas e criadas por usuários)
- Bots que enviam mensagens automáticas nas salas
- Controle dinâmico de bots via API
- Interface com contador de participantes (inclusive bots)
- Variáveis de ambiente dinâmicas

---

## Variáveis .env Utilizadas

```
ENABLE_BOTS=true
NUMBER_BOTS=2,3,4
INTERVALO_MENSAGENS_BOTS=8000,15000
TOKEN_ADMIN_BOTS=supertoken123
```

---

## Rotas da API para controle dos bots

### Ativar bots

```http
POST /api/bots/ativar
Headers:
  Authorization: Bearer supertoken123
```

### Desativar bots

```http
POST /api/bots/desativar
Headers:
  Authorization: Bearer supertoken123
```

### Ver status dos bots

```http
GET /api/bots/status
Headers:
  Authorization: Bearer supertoken123
```

### Configurar quantidade de bots

```http
POST /api/bots/configurar
Headers:
  Authorization: Bearer supertoken123
  Content-Type: application/json
Body:
  {
    "valores": "2,3,4"
  }
```

### Configurar intervalo das mensagens dos bots

```http
POST /api/bots/intervalo
Headers:
  Authorization: Bearer supertoken123
  Content-Type: application/json
Body:
  {
    "intervalo": "8000,15000"
  }
  
  10000 ms ==> equivale a 10s
  
```

---

## Comandos curl

### Ativar bots

```bash
curl -X POST http://localhost:3000/api/bots/ativar -H "Authorization: Bearer supertoken123"
```

### Desativar bots

```bash
curl -X POST http://localhost:3000/api/bots/desativar -H "Authorization: Bearer supertoken123"
```

### Status bots

```bash
curl http://localhost:3000/api/bots/status -H "Authorization: Bearer supertoken123"
```

### Configurar quantidade de bots

```bash
curl -X POST http://localhost:3000/api/bots/configurar -H "Authorization: Bearer supertoken123" -H "Content-Type: application/json" -d "{"valores": "2,3,4"}"
```

### Configurar intervalo das mensagens dos bots

```bash
curl -X POST http://localhost:3000/api/bots/intervalo -H "Authorization: Bearer supertoken123" -H "Content-Type: application/json" -d "{"intervalo": "8000,15000"}"
```
