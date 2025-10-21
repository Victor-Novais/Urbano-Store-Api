// Teste rápido da API após correção
const BASE_URL = 'http://localhost:3000';

async function quickTest() {
    console.log('🧪 Teste rápido da API...\n');

    try {
        // Teste 1: Criar produto sem imagem
        console.log('1️⃣ Criando produto sem imagem...');
        const response1 = await fetch(`${BASE_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Produto Teste Rápido',
                description: 'Teste após correção',
                price_sale: 19.99,
                cost: 10.00,
                quantity: 5
            })
        });

        if (response1.ok) {
            const product1 = await response1.json();
            console.log(`✅ Produto criado sem imagem - ID: ${product1.id}`);
        } else {
            const error1 = await response1.text();
            console.log(`❌ Erro: ${response1.status} - ${error1}`);
        }

        // Teste 2: Criar produto com URL de imagem
        console.log('\n2️⃣ Criando produto com URL de imagem...');
        const response2 = await fetch(`${BASE_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Produto com Imagem',
                description: 'Teste com URL',
                price_sale: 29.99,
                cost: 15.00,
                quantity: 3,
                imageUrl: 'https://exemplo.supabase.co/storage/v1/object/public/imagens/teste.jpg'
            })
        });

        if (response2.ok) {
            const product2 = await response2.json();
            console.log(`✅ Produto criado com imagem - ID: ${product2.id}`);
        } else {
            const error2 = await response2.text();
            console.log(`❌ Erro: ${response2.status} - ${error2}`);
        }

        // Teste 3: Listar produtos
        console.log('\n3️⃣ Listando produtos...');
        const response3 = await fetch(`${BASE_URL}/products`);
        if (response3.ok) {
            const data = await response3.json();
            console.log(`✅ ${data.data?.length || 0} produtos encontrados`);
        } else {
            console.log(`❌ Erro na listagem: ${response3.status}`);
        }

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    }

    console.log('\n🎉 Teste concluído!');
}

quickTest();
