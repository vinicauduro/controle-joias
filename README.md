# Controle de Joias

Controle do negócio de joias de ouro: estoque, vendas, clientes e contas a receber.

Abra em **https://vinicauduro.github.io/controle-joias/** e, no celular, use
"Adicionar à tela inicial" para instalar como aplicativo.

## O que faz

- **No topo**: a cotação de mercado do grama de ouro 24k (atualiza sozinha a cada 15 minutos;
  toque para atualizar) e, ao lado, o preço do grama para venda, que se altera com um toque.
- **Estoque**: cadastro das peças com peso, valor do grama pago, índice, frete e mão de obra
  (o custo é calculado sozinho) e preço de venda sugerido (peso × preço do grama).
  Reservar peça para uma cliente, dar baixa (perda, devolução, conserto) e buscar por
  fornecedor, tipo de peça ou referência.
- **Vendas**: uma ou várias peças por venda, com lucro e markup na hora. À vista (Pix,
  dinheiro, cartão) ou parcelado com entrada.
- **A receber**: parcelas vencidas e a vencer, botão "Recebi" e lembrete pelo WhatsApp.
- **Clientes**: histórico de compras, quanto deve e peças reservadas.
- **Painel e relatórios**: valor do estoque, vendas e lucro do mês, lucro dos últimos 12 meses,
  peças paradas há mais de 6 meses, e relatórios por fornecedor, tipo de peça, mês e compra.
- **Importar a planilha antiga** (`.xlsx`, uma aba por fornecedor), **exportar para Excel**
  e **backup**.

## Onde ficam os dados

Os dados ficam guardados **só no aparelho** em que o app é usado (armazenamento do navegador).
Nada vai para o GitHub nem para a internet. Por isso:

- faça o **backup** toda semana (Mais › Fazer backup) e guarde no Drive ou no WhatsApp;
- para passar para outro aparelho, use **Mais › Restaurar backup** nele.

## Importação da planilha

Cada aba é um fornecedor; cada bloco "REFERENCIAS | ITENS … | data" é uma compra.
A peça com **valor realizado** é tratada como vendida (a venda entra sem data e já quitada);
sem valor realizado, fica em estoque. Se a coluna A tiver um nome de pessoa e não houver venda,
a peça fica reservada para ela. PERDI, DEVOLVIDA e CONSERTO viram baixa. Linhas sem custo e sem
valor do grama são ignoradas e listadas na tela de importação. Abas sem peças (EMPRESTIMOS,
TOTAL) são ignoradas. Importar de novo substitui o que veio da planilha anterior.
