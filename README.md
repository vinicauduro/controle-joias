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
- **Vendas**: uma ou várias peças por venda. Pix/transferência, dinheiro, débito, crédito em
  1 a 12 vezes ou crediário com entrada. A **taxa da máquina** é calculada pela tabela de taxas
  (editável em Mais) e a **embalagem** (caixa + sacola P/M, editável) entra como despesa: o app
  mostra o **lucro líquido** = venda − custo − taxa − embalagem.
- **A receber**: parcelas vencidas e a vencer, botão "Recebi" e lembrete pelo WhatsApp.
- **Clientes**: histórico de compras, quanto deve e peças reservadas.
- **Painel e relatórios**: valor do estoque, vendas e lucro do mês, lucro dos últimos 12 meses,
  peças paradas há mais de 6 meses, e relatórios por fornecedor, tipo de peça, mês e compra.
- **Importar a planilha antiga** (`.xlsx`, uma aba por fornecedor), **exportar para Excel**
  e **backup**.

## Onde ficam os dados

Com a nuvem ligada (Supabase), os dados ficam na nuvem e em cada aparelho: entre com a
**mesma conta** no celular e no computador e tudo aparece igual. Sem internet, o app
continua funcionando e envia as alterações quando a conexão volta (o ☁️ no topo mostra
a situação: ✓ sincronizado, ⏳ alterações para enviar, ✕ sem internet).

Sem a nuvem (chaves vazias em `config.js`), os dados ficam só no aparelho; nesse caso,
faça o **backup** toda semana (Mais › Fazer backup).

## Ligar a nuvem (uma vez só)

1. **Projeto.** O app usa o mesmo projeto Supabase da Agenda Corretor (CRM), já configurado em
   `config.js`. A tabela é separada e as contas das joias não têm acesso ao CRM.
2. **Tabela.** Em **SQL Editor › New query**, cole o conteúdo de [`schema.sql`](schema.sql)
   e clique em **Run**. Pode rodar de novo sem perder nada.
3. **Login.** Em **Authentication › Sign In / Providers › Email**, deixe *Email* ativado.
   Em **Authentication › URL Configuration › Redirect URLs**, acrescente
   `https://vinicauduro.github.io/controle-joias/` (usado no "Esqueci a senha" e na confirmação
   de e-mail). Não mude o *Site URL*, que é o da agenda.
4. Abra o app, toque em **Criar conta** e depois entre com a mesma conta nos outros aparelhos.
   O que já estava no aparelho sobe para a nuvem no primeiro login.

A chave *anon/publishable* pode ficar no código: ela só dá acesso ao que as regras do banco
permitem, e cada conta só enxerga os próprios dados.

## Importação da planilha

Cada aba é um fornecedor; cada bloco "REFERENCIAS | ITENS … | data" é uma compra.
A peça com **valor realizado** é tratada como vendida (a venda entra sem data e já quitada);
sem valor realizado, fica em estoque. Se a coluna A tiver um nome de pessoa e não houver venda,
a peça fica reservada para ela. PERDI, DEVOLVIDA e CONSERTO viram baixa. Linhas sem custo e sem
valor do grama são ignoradas e listadas na tela de importação. Abas sem peças (EMPRESTIMOS,
TOTAL) são ignoradas. Importar de novo substitui o que veio da planilha anterior.
