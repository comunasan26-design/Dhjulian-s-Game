# Referência de efeitos

> Arquivo gerado automaticamente por `npm run cartas:docs`. Não edite à mão.

Raças válidas (para `racas`): `divino`, `anao`, `draconato`, `elfo`, `gnomo`, `gigante`, `humano`, `orc`, `diabrete`, `elemental`, `goblin`, `centauro`, `torkle`, `owlin`, `tritao`, `fada`, `vampirico`.

Classes válidas (para `classes`): `guerreiro`, `mago`, `clerigo`, `ladino`, `druida`, `paladino`, `barbaro`, `bardo`, `feiticeiro`, `bruxo`, `monge`, `patrulheiro`, `ilusionista`, `berserker`, `artifice`, `alquimista`.

Tags de monstro (para `tags`): `morto-vivo`, `demonio`, `dragao`, `fogo`, `aquatico`, `animal`, `voador`, `sagrado`.

## Efeitos de itens

Usados em `itens.json`.

### `bonusPara`

Bônus a mais se o dono tiver uma das raças/classes.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"bonusPara","valor":2}
```

### `bonusContra`

Bônus a mais contra certos monstros.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `tags` | lista | não | tags do monstro, ex.: ["morto-vivo"] |
| `gigantes` | sim/nao | não | vale contra Gigantes |
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"bonusContra","valor":2}
```

### `protecao`

O item não pode ser perdido por Coisas Ruins.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `contra` | texto | sim | tudo, fogo (monstros de Fogo) ou acido (ácido/ferrugem) |

```json
{"tipo":"protecao","contra":"tudo"}
```

### `protegeCapacete`

Enquanto equipado, você não perde o capacete por Coisas Ruins.

```json
{"tipo":"protegeCapacete"}
```

### `imuneCoisasRuins`

Imune às Coisas Ruins de monstros com certas tags.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `tags` | lista | sim | tags, ex.: ["fogo"] |
| `excetoLendarios` | sim/nao | não | não vale contra Lendários |

```json
{"tipo":"imuneCoisasRuins","tags":["fogo"],"excetoLendarios":true}
```

### `imuneVeneno`

Imune a veneno e doença (monstros marcados com "veneno" e o sopro do Dragão Verde).

```json
{"tipo":"imuneVeneno"}
```

### `metadeErrantes`

Monstros Errantes jogados contra você valem metade (força e tesouros).

```json
{"tipo":"metadeErrantes"}
```

### `naoPerseguidoPorGoblinoides`

Monstros marcados como "goblinoide" não perseguem você.

```json
{"tipo":"naoPerseguidoPorGoblinoides"}
```

### `refleteMaldicao`

1x por rodada, uma maldição lançada em você volta para quem lançou.

```json
{"tipo":"refleteMaldicao"}
```

### `nivelExtraAoVencer`

Ao vencer, role 1d6: com o valor indicado (ou mais) suba 1 nível extra.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `dado` | numero | sim | resultado mínimo no dado |

```json
{"tipo":"nivelExtraAoVencer","dado":2}
```

### `rerrolarFuga`

1x por combate, refaça uma rolagem de Fugir sua.

```json
{"tipo":"rerrolarFuga"}
```

### `anulaMaldicao`

Anula 1 maldição lançada em você e depois vira outra carta.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `viraEm` | texto | sim | id do item em que se transforma |

```json
{"tipo":"anulaMaldicao","viraEm":"exemplo"}
```

### `bloqueiaErrantes`

Ninguém pode jogar Monstros Errantes no seu combate.

```json
{"tipo":"bloqueiaErrantes"}
```

### `perdeMenosNiveis`

Ao perder níveis por Coisas Ruins, perca menos (1x por rodada).

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantos níveis a menos |

```json
{"tipo":"perdeMenosNiveis","quantidade":2}
```

### `desejos`

Tem cargas: gaste 1 para anular as Coisas Ruins de um combate.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `cargas` | numero | sim | número de cargas |
| `viraEm` | texto | não | id do item em que vira sem cargas |

```json
{"tipo":"desejos","cargas":2,"viraEm":"exemplo"}
```

### `verMao`

1x por rodada, olhe a mão de um jogador.

```json
{"tipo":"verMao"}
```

### `fugirDeTudo`

Você pode fugir até de monstros que dizem "não dá para fugir".

```json
{"tipo":"fugirDeTudo"}
```

### `podeEmpacar`

Ao fugir, role 1d6: com 1 a fuga falha.

```json
{"tipo":"podeEmpacar"}
```

### `sopro`

1x por combate, quem estiver lutando ganha o bônus e causa dano de fogo.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"sopro","valor":2}
```

### `atirarDeLonge`

Quem tem uma das raças pode somar o bônus do item ao combate de outro jogador sem entrar nele (1x por combate).

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |

```json
{"tipo":"atirarDeLonge","racas":["elfo"],"classes":["mago"]}
```

### `grandeExtra`

Permite equipar 1 item Grande a mais (opcionalmente só para certas raças).

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |

```json
{"tipo":"grandeExtra","racas":["elfo"],"classes":["mago"]}
```

## Efeitos de monstros

Usados em `monstros.json (campo "efeitos")`.

### `bonusContra`

O monstro ganha bônus quando a condição vale para alguém do lado dos jogadores.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |
| `itemEquipado` | texto | não | id de um item que, equipado, dá o bônus ao monstro |
| `montado` | sim/nao | não | contra quem tem montaria |
| `perdeuNivelNaRodada` | sim/nao | não | contra quem perdeu nível nesta rodada |
| `itensEquipadosMin` | numero | não | contra quem tem pelo menos N itens equipados |
| `semFogo` | sim/nao | não | só se ninguém causar dano de fogo |
| `porAjudante` | sim/nao | não | o valor é somado para cada ajudante |
| `porNivelAcimaDe` | numero | não | o valor é somado para cada nível do lutador acima deste |
| `porCartaNaMao` | sim/nao | não | o valor é somado para cada carta na mão do lutador |
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"bonusContra","valor":2}
```

### `jogadoresGanham`

Cada jogador do lado dos jogadores que atende à condição ganha o valor.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |
| `armaDeImpacto` | sim/nao | não | também vale para quem tem arma de impacto equipada |
| `soAjudante` | sim/nao | não | vale só para o ajudante |
| `excetoClasses` | lista | não | classes que ignoram este efeito |
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"jogadoresGanham","valor":2}
```

### `fogoDaBonus`

Se alguém do lado dos jogadores causar dano de fogo, os jogadores ganham o valor.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"fogoDaBonus","valor":2}
```

### `anula`

Um tipo de item não soma bônus contra este monstro.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `alvo` | texto | sim | itensDeMao, metadeItensDeMao, itensGrandes, montarias, peitorais, aneis ou doisMaioresItens |

```json
{"tipo":"anula","alvo":"itensDeMao"}
```

### `naoPersegue`

O monstro não persegue (fuga automática) quem atende à condição.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |
| `nivelMinimo` | numero | não | não persegue jogadores deste nível ou mais |
| `nivelMaximo` | numero | não | não persegue jogadores deste nível ou menos |
| `semArmadura` | sim/nao | não | não persegue quem não tem armadura |

```json
{"tipo":"naoPersegue"}
```

### `dispensavel`

Quem luta e tem uma das raças/classes pode mandar o monstro embora.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |
| `descartar` | numero | não | cartas a descartar para dispensar (0 ou 1) |
| `tesouros` | numero | não | tesouros que ganha ao dispensar |
| `niveis` | numero | não | níveis que ganha ao dispensar (nunca o 20) |

```json
{"tipo":"dispensavel"}
```

### `aoRevelar`

Ao aparecer, rola 1d6: com o valor indicado ou menos, aplica o efeito.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `dadoAte` | numero | sim | valor máximo do dado para o efeito valer |
| `jogadorGanha` | numero | não | quanto o lutador ganha (negativo = perde) |
| `monstroGanha` | numero | não | quanto o monstro ganha (negativo = perde) |

```json
{"tipo":"aoRevelar","dadoAte":2}
```

### `fugirIgnoradoPor`

Essas classes ignoram o modificador de Fugir do monstro.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |

```json
{"tipo":"fugirIgnoradoPor","racas":["elfo"],"classes":["mago"]}
```

### `desejo`

Antes do combate, quem luta pode subir 1 nível; se aceitar, o monstro ganha o valor.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"desejo","valor":2}
```

### `incendeiaVila`

Se ninguém o derrotar, todos os outros jogadores perdem níveis.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `niveis` | numero | sim | níveis perdidos |

```json
{"tipo":"incendeiaVila","niveis":2}
```

### `filacteria`

Se for derrotado sem alguém dessas classes no combate, volta ao topo do baralho de Portas.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `racas` | lista | não | raças (ids) que contam, ex.: ["elfo", "anao"] |
| `classes` | lista | não | classes (ids) que contam, ex.: ["mago"] |

```json
{"tipo":"filacteria","racas":["elfo"],"classes":["mago"]}
```

### `tesouroExtraAjudante`

Cada ajudante que vencer compra tesouros extras.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"tesouroExtraAjudante","quantidade":2}
```

### `grito`

Ao aparecer, o jogador à esquerda pode pôr 1 monstro da mão no combate.

```json
{"tipo":"grito"}
```

### `voltaAoFugir`

Se fugirem dele, volta ao topo do baralho de Portas.

```json
{"tipo":"voltaAoFugir"}
```

### `semPedirAjuda`

Quem luta não pode pedir ajuda (outros podem se oferecer).

```json
{"tipo":"semPedirAjuda"}
```

### `paralisaAtivas`

Ninguém do lado dos jogadores usa habilidades ativas (Clérigos ignoram).

```json
{"tipo":"paralisaAtivas"}
```

### `drenoDeVida`

A Cura do Clérigo não devolve níveis perdidos para este monstro.

```json
{"tipo":"drenoDeVida"}
```

### `ajudanteSofre`

Quem ajudar também sofre as Coisas Ruins se perderem.

```json
{"tipo":"ajudanteSofre"}
```

### `dobraPrimeiroBonus`

O primeiro bônus de monstro jogado a favor dele vale o dobro.

```json
{"tipo":"dobraPrimeiroBonus"}
```

### `seduzAjudante`

O ajudante passa a lutar do lado do monstro.

```json
{"tipo":"seduzAjudante"}
```

### `imuneMagia`

Nenhuma habilidade ativa funciona neste combate.

```json
{"tipo":"imuneMagia"}
```

### `semPocoes`

Ninguém pode usar poções neste combate.

```json
{"tipo":"semPocoes"}
```

### `escravizaMente`

O jogador com mais cartas na mão (fora quem luta) luta do lado do monstro.

```json
{"tipo":"escravizaMente"}
```

### `maldicaoDoFarao`

Mesmo vencendo, quem lutou perde 1 item aleatório.

```json
{"tipo":"maldicaoDoFarao"}
```

### `detectaMentiras`

Quem lançou maldição nesta rodada não pode ajudar nem atrapalhar.

```json
{"tipo":"detectaMentiras"}
```

### `explodeAoMorrer`

Mesmo vencendo, cada jogador do lado vencedor perde 1 item equipado à escolha.

```json
{"tipo":"explodeAoMorrer"}
```

### `venenoNoAjudante`

Cada ajudante perde 1 nível ao entrar no combate.

```json
{"tipo":"venenoNoAjudante"}
```

### `imbativel`

Nenhuma habilidade pode encantá-lo, convencê-lo, transformá-lo ou dispensá-lo.

```json
{"tipo":"imbativel"}
```

## Coisas Ruins de monstros

Usados em `monstros.json (campo "coisasRuins")`.

### `perderNiveis`

Perca níveis.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"perderNiveis","quantidade":2}
```

### `perderSlot`

Perca os itens de um slot.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `slot` | texto | sim | capacete, peitoral, calcas, botas, montaria ou maos |

```json
{"tipo":"perderSlot","slot":"capacete"}
```

### `perderAneis`

Perca anéis à sua escolha (use "todos" para todos).

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | texto | sim | número ou "todos" |

```json
{"tipo":"perderAneis","quantidade":"exemplo"}
```

### `perderCartasDaMao`

Perca cartas aleatórias da mão.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"perderCartasDaMao","quantidade":2}
```

### `morte`

Morte.

```json
{"tipo":"morte"}
```

### `escolherItensParaPerder`

Perca itens equipados à sua escolha.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"escolherItensParaPerder","quantidade":2}
```

### `perderItensAleatorios`

Perca itens equipados aleatórios.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"perderItensAleatorios","quantidade":2}
```

### `perderGrandeOuDoisItens`

Perca 1 item Grande; sem item Grande, perca 2 itens à sua escolha.

```json
{"tipo":"perderGrandeOuDoisItens"}
```

### `perderGrandeOuNiveis`

Perca 1 item Grande ou níveis (a vítima escolhe).

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `niveis` | numero | sim | níveis |

```json
{"tipo":"perderGrandeOuNiveis","niveis":2}
```

### `podridaoDeMumia`

Fica com -2 em combate por 2 rodadas (conta como maldição).

```json
{"tipo":"podridaoDeMumia"}
```

### `possessao`

O jogador à esquerda escolhe 1 item seu e fica com ele.

```json
{"tipo":"possessao"}
```

### `quimera`

Role 1d6 três vezes: perca 1 nível para cada resultado de 1 a 3.

```json
{"tipo":"quimera"}
```

### `virarVampirico`

Se morrer neste combate, sua raça vira Vampírico.

```json
{"tipo":"virarVampirico"}
```

### `perderItensNaoEquipados`

Perca todos os itens que não estiverem equipados.

```json
{"tipo":"perderItensNaoEquipados"}
```

### `outrosPerdemNiveis`

Todos os outros jogadores perdem níveis.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"outrosPerdemNiveis","quantidade":2}
```

## Efeitos de maldições

Usados em `maldicoes.json`.

### `perderNiveis`

Perca níveis.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | níveis perdidos |
| `nivelMinimoParaExtra` | numero | não | a partir deste nível perde a mais |
| `extra` | numero | não | quantos níveis a mais |

```json
{"tipo":"perderNiveis","quantidade":2}
```

### `perderSlot`

Perca os itens de um slot.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `slot` | texto | sim | capacete, peitoral, calcas, botas ou montaria |

```json
{"tipo":"perderSlot","slot":"capacete"}
```

### `perderAneis`

Perca anéis à escolha de quem lançou.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"perderAneis","quantidade":2}
```

### `perderMelhorItem`

Perca o item equipado de maior bônus.

```json
{"tipo":"perderMelhorItem"}
```

### `descartarCartas`

Descarte cartas aleatórias da mão.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"descartarCartas","quantidade":2}
```

### `impostos`

Dê 1 carta aleatória da mão a cada jogador de nível menor.

```json
{"tipo":"impostos"}
```

### `trocaFeerica`

O jogador à esquerda troca 1 item equipado com você (mesmo slot, escolha dele).

```json
{"tipo":"trocaFeerica"}
```

### `perderClasse`

Descarte sua classe.

```json
{"tipo":"perderClasse"}
```

### `virarRaca`

Descarte sua raça e vire outra.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `raca` | texto | sim | id da raça |

```json
{"tipo":"virarRaca","raca":"exemplo"}
```

### `forcaNoCombate`

(De combate) Muda a força do alvo no combate.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |
| `valorNivel11` | numero | não | valor se o alvo tiver nível 11 ou mais |

```json
{"tipo":"forcaNoCombate","valor":2,"valorNivel11":2}
```

### `naoPodeFugir`

(De combate) O alvo não pode fugir.

```json
{"tipo":"naoPodeFugir"}
```

### `monstroGanha`

(De combate) O monstro ganha o valor.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"monstroGanha","valor":2}
```

### `ninguemAjuda`

(De combate) Ninguém pode ajudar o alvo.

```json
{"tipo":"ninguemAjuda"}
```

### `semAtivas`

(De combate) O alvo não pode usar habilidades ativas.

```json
{"tipo":"semAtivas"}
```

### `chamadoDaHorda`

(De combate) Vira cartas de Porta até achar um monstro, que entra como Monstro Errante.

```json
{"tipo":"chamadoDaHorda"}
```

### `ajudanteTraidor`

(De combate) O ajudante do alvo passa para o lado do monstro.

```json
{"tipo":"ajudanteTraidor"}
```

### `forca`

(Contínua) Muda a força do alvo em todo combate.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"forca","valor":2}
```

### `menosNoDado`

(Contínua) Tira o valor de todas as rolagens de dado do alvo.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"menosNoDado","valor":2}
```

### `semItensDeMao`

(Contínua) Itens de mão não somam bônus.

```json
{"tipo":"semItensDeMao"}
```

### `semArmaduraEArmas`

(Contínua) Armaduras e armas não somam bônus.

```json
{"tipo":"semArmaduraEArmas"}
```

### `naoPodeNegociar`

(Contínua) Não pode vender, trocar nem dar itens.

```json
{"tipo":"naoPodeNegociar"}
```

### `metadeTesouros`

(Contínua) Compra metade dos tesouros ao vencer.

```json
{"tipo":"metadeTesouros"}
```

### `pulaTurno`

(Contínua) Pula o próximo turno.

```json
{"tipo":"pulaTurno"}
```

### `menosTesouros`

(Contínua) Compra menos tesouros ao vencer.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"menosTesouros","quantidade":2}
```

### `descartaNoInicioDoTurno`

(Contínua) No início de cada turno, descarte 1 carta da mão.

```json
{"tipo":"descartaNoInicioDoTurno"}
```

### `ocupaUmaMao`

(Contínua) Ocupa 1 slot de mão.

```json
{"tipo":"ocupaUmaMao"}
```

### `semLendarios`

(Contínua) Não pode ter item Lendário equipado.

```json
{"tipo":"semLendarios"}
```

### `monstrosGanham`

(Contínua) Todo monstro que o alvo enfrentar ganha o valor.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |
| `someAoDerrotarNivel` | numero | não | some ao derrotar monstro deste nível ou mais |

```json
{"tipo":"monstrosGanham","valor":2,"someAoDerrotarNivel":2}
```

### `acabaComBeijo`

Acaba se outro jogador descartar 1 carta para beijar o alvo.

```json
{"tipo":"acabaComBeijo"}
```

### `removidaPorAguaBenta`

Pode ser removida com Água Benta.

```json
{"tipo":"removidaPorAguaBenta"}
```

## Efeitos de poções

Usados em `pocoes.json`.

### `bonusLado`

Soma o valor a um lado do combate.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |
| `fogo` | sim/nao | não | conta como dano de fogo |
| `quemBebeFugir` | numero | não | muda o Fugir de quem bebe |

```json
{"tipo":"bonusLado","valor":2}
```

### `menosEmAlvo`

Tira o valor do monstro ou de um jogador.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto tira |

```json
{"tipo":"menosEmAlvo","valor":2}
```

### `bonusFugir`

Soma ao Fugir de um jogador no combate.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"bonusFugir","valor":2}
```

### `contraMortosVivos`

Soma o valor contra Mortos-vivos e Demônios.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"contraMortosVivos","valor":2}
```

### `removePodridao`

Remove maldições marcadas com removidaPorAguaBenta.

```json
{"tipo":"removePodridao"}
```

### `devolveNivel`

Devolve níveis perdidos neste combate.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"devolveNivel","quantidade":2}
```

### `forcaAjuda`

Obriga um jogador a ajudar você (sem tesouro).

```json
{"tipo":"forcaAjuda"}
```

### `fugaAutomatica`

Foge automaticamente.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `excetoLendarios` | sim/nao | não | não funciona contra Lendários |

```json
{"tipo":"fugaAutomatica","excetoLendarios":true}
```

### `subirNivel`

Sobe níveis (nunca para o 20).

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"subirNivel","quantidade":2}
```

## Efeitos de runas

Usados em `runas.json`.

### `bonusItem`

O item ganha bônus.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"bonusItem","valor":2}
```

### `fugir`

Soma ao Fugir (conta no limite de +2 dos anéis se estiver num anel).

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"fugir","valor":2}
```

### `fogo`

O dano do item conta como fogo.

```json
{"tipo":"fogo"}
```

### `protegeAcido`

O item não pode ser perdido por ácido nem ferrugem.

```json
{"tipo":"protegeAcido"}
```

### `naoRoubavel`

O item não pode ser roubado nem trocado.

```json
{"tipo":"naoRoubavel"}
```

### `rerrolaUm`

1x por rodada, refaz um resultado 1 no dado (automático).

```json
{"tipo":"rerrolaUm"}
```

### `perdeNivelAoPerder`

Se perder um combate, perde níveis a mais.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"perdeNivelAoPerder","quantidade":2}
```

### `dobraItem`

Dobra o bônus do item.

```json
{"tipo":"dobraItem"}
```

### `contaComoLendario`

O item passa a contar como Lendário.

```json
{"tipo":"contaComoLendario"}
```

## Efeitos de itens diversos

Usados em `diversos.json`.

### `isca`

Jogue no combate de outro jogador: o monstro ganha o valor.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | quanto soma (use número negativo para tirar) |

```json
{"tipo":"isca","valor":2}
```

### `rerrolarFuga`

Refaça uma rolagem de Fugir sua (uso único).

```json
{"tipo":"rerrolarFuga"}
```

### `kitLadrao`

Bônus no Roubo, ou permite roubar sem ser Ladino.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `bonus` | numero | não | bônus para Ladinos |
| `sucessoSemLadino` | numero | não | resultado mínimo para quem não é Ladino |

```json
{"tipo":"kitLadrao","bonus":2,"sucessoSemLadino":2}
```

### `espelho`

Manda um Monstro Errante do seu combate para outro jogador enfrentar no próximo turno dele.

```json
{"tipo":"espelho"}
```

### `limiteMao`

(Permanente, na mesa) Aumenta o limite de mão.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `quantidade` | numero | sim | quantidade |

```json
{"tipo":"limiteMao","quantidade":2}
```

### `mapa`

Jogue no seu combate: ao vencer, compre tesouros a mais.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `tesouros` | numero | sim | tesouros a mais |

```json
{"tipo":"mapa","tesouros":2}
```

### `teletransporte`

Fuja de qualquer combate, até de Lendários.

```json
{"tipo":"teletransporte"}
```

### `vendaMultiplicador`

(Permanente, na mesa) Multiplica o ouro das suas vendas.

| Parâmetro | Tipo | Obrigatório | O que faz |
|---|---|---|---|
| `valor` | numero | sim | multiplicador, ex.: 1.5 |

```json
{"tipo":"vendaMultiplicador","valor":2}
```

