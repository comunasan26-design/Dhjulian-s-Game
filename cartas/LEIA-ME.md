# Como editar e criar cartas

Todas as cartas do jogo ficam nesta pasta, em arquivos `.json` (texto simples). Você não precisa saber programar:
basta mudar os textos e números, ou copiar uma carta e alterar.

| Arquivo | O que tem |
|---|---|
| `racas.json` | Raças |
| `classes.json` | Classes |
| `itens.json` | Equipamentos (capacetes, armaduras, armas, anéis, colares, montarias) |
| `pocoes.json` | Poções |
| `runas.json` | Runas |
| `diversos.json` | Itens diversos (Isca, Mapa, Pergaminho…) |
| `subir-nivel.json` | Cartas de subir de nível |
| `monstros.json` | Monstros |
| `maldicoes.json` | Maldições |
| `bonus-monstro.json` | Bônus de monstro (+3, -5…) |
| `monstro-errante.json` | Monstro Errante |
| `EFEITOS.md` | **Lista de todos os efeitos** que você pode colocar nas cartas |

## Regras básicas do JSON

- Textos ficam entre aspas: `"nome": "Espada de Fogo"`.
- Números ficam **sem** aspas: `"bonus": 3`.
- Sim/não: `true` ou `false` (sem aspas).
- Listas ficam entre colchetes: `"tags": ["fogo", "voador"]`.
- Cada carta fica entre chaves `{ … }` e as cartas são separadas por vírgula.
- Não deixe vírgula depois do último item de uma lista ou carta.

Dica: depois de editar, cole o arquivo em um validador de JSON (por exemplo, pesquise “JSON validator”) para achar
vírgulas ou aspas faltando.

## Mudar uma carta existente

Abra o arquivo, ache a carta pelo `"nome"` e altere o que quiser. Exemplo: deixar o Elmo de Couro mais forte:

```json
{
  "id": "elmo-couro",
  "nome": "Elmo de Couro",
  "slot": "capacete",
  "raridade": "comum",
  "bonus": 3,
  "preco": 300
}
```

Para tirar uma carta do baralho sem apagá-la, use `"copias": 0`. Para ter mais cópias, `"copias": 3`.

## Criar uma carta nova

1. Copie uma carta parecida (do `{` até o `}`) e cole logo depois dela (não esqueça a vírgula entre as duas).
2. Troque o `"id"` por um nome único, **só com letras minúsculas sem acento, números e hífen** (ex.: `"espada-de-gelo"`).
3. Troque o `"nome"`, os números e o `"texto"`.
4. Se quiser um efeito especial, coloque em `"efeitos"` (veja abaixo).

### Exemplo: um item novo

```json
{
  "id": "espada-de-gelo",
  "nome": "Espada de Gelo",
  "slot": "mao",
  "maos": 1,
  "raridade": "raro",
  "bonus": 4,
  "preco": 600,
  "texto": "+3 contra monstros de Fogo. Guerreiros ganham +1 a mais.",
  "efeitos": [
    { "tipo": "bonusContra", "tags": ["fogo"], "valor": 3 },
    { "tipo": "bonusPara", "classes": ["guerreiro"], "valor": 1 }
  ]
}
```

Campos de item: `id`, `nome`, `slot` (`capacete`, `peitoral`, `calcas`, `botas`, `mao`, `anel`, `colar`, `montaria`),
`maos` (1 ou 2, só para armas), `raridade` (`comum`, `incomum`, `raro`, `epico`, `lendario`), `bonus`, `fugir`
(bônus de Fugir), `grande` (true/false), `preco`, `copias`, `somente` e `proibido`
(`{ "racas": [...], "classes": [...] }`), `fogo`, `impacto`, `tags` (para montarias), `texto` e `efeitos`.

### Exemplo: um monstro novo

```json
{
  "id": "lobisomem",
  "nome": "Lobisomem",
  "nivel": 12,
  "tags": ["animal"],
  "tesouros": 3,
  "niveis": 1,
  "fugir": -1,
  "especial": "+4 contra Elfos. Itens de mão não somam. Druidas podem dispensá-lo descartando 1 carta.",
  "efeitos": [
    { "tipo": "bonusContra", "racas": ["elfo"], "valor": 4 },
    { "tipo": "anula", "alvo": "itensDeMao" },
    { "tipo": "dispensavel", "classes": ["druida"], "descartar": 1 }
  ],
  "coisasRuinsTexto": "Mordida: perca 2 níveis e as botas.",
  "coisasRuins": [
    { "tipo": "perderNiveis", "quantidade": 2 },
    { "tipo": "perderSlot", "slot": "botas" }
  ]
}
```

Campos de monstro: `id`, `nome`, `nivel` (de 31 para cima é Lendário), `tags`, `tesouros`, `niveis` (níveis que dá ao
ser derrotado), `fugir` (modificador de Fugir contra ele), `naoDaPraFugir`, `acido` (ácido/ferrugem), `veneno`, `gigante`,
`goblinoide`, `especial` (texto), `efeitos`, `coisasRuinsTexto` (texto) e `coisasRuins` (o que acontece de verdade).

### Exemplo: uma maldição nova

```json
{
  "id": "pes-de-vento",
  "nome": "Pés de Vento",
  "tipo": "duracao",
  "duracao": 2,
  "texto": "-2 em todas as rolagens de dado e -1 em combate.",
  "efeitos": [
    { "tipo": "menosNoDado", "valor": 2 },
    { "tipo": "forca", "valor": -1 }
  ]
}
```

Tipos de maldição: `instantanea` (efeito na hora), `combate` (vale no combate atual ou no próximo do alvo), `duracao`
(dura `duracao` rodadas) e `persistente` (fica até ser removida). Use efeitos que combinem com o tipo (veja `EFEITOS.md`).

### Poções, runas e itens diversos

```json
{ "id": "pocao-gigante", "nome": "Poção do Gigante", "raridade": "raro", "preco": 600, "texto": "+6 para um lado do combate.",
  "efeitos": [ { "tipo": "bonusLado", "valor": 6 } ] }
```

### Bônus de monstro e subir de nível

```json
{ "id": "furioso", "nome": "Furioso", "valor": 7, "texto": "Acordou de mau humor." }
```

```json
{ "id": "festa", "nome": "Festa na Taverna", "texto": "Todos brindam ao herói." }
```

## Raças e classes

As habilidades de raças e classes são programadas no jogo. Você pode mudar nomes e textos, e também **criar uma raça ou
classe nova reaproveitando as habilidades** de uma existente com `"habilidadesDe"`:

```json
{
  "id": "anao-da-montanha",
  "nome": "Anão da Montanha",
  "habilidadesDe": "anao",
  "passiva": { "nome": "Teimosia Anã", "texto": "…" },
  "ativa": { "nome": "Reforjar", "texto": "…" }
}
```

Nos efeitos, `"racas"` e `"classes"` usam esses ids de habilidades (ex.: `"anao"`), então valem também para raças
novas que usem `"habilidadesDe": "anao"`.

## Conferir se está tudo certo

Quem roda o projeto pode usar:

```bash
npm run cartas:validar
```

O comando aponta o arquivo, a carta e o problema em português (ex.: *“cartas/itens.json → carta "espada-de-gelo":
"bonus" precisa ser um número (sem aspas)”*). O deploy na Vercel também valida as cartas e não publica uma versão com erro.

Depois de adicionar efeitos novos ao jogo (programação), rode `npm run cartas:docs` para atualizar o `EFEITOS.md`.

## Cuidados

- As mudanças valem para **partidas novas**. Não apague nem renomeie o `id` de uma carta enquanto houver partidas em
  andamento que a usem; prefira `"copias": 0`.
- As raças `humano` e `vampirico` precisam existir (são usadas por efeitos de maldição e de monstro).
