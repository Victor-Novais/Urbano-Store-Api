// =============================================
// Script de Teste da API
// Urbano Store API
// =============================================

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
    console.log('🧪 Testando API do Urbano Store...\n');

    try {
        // 1. Teste: Listar produtos
        console.log('1️⃣ Testando listagem de produtos...');
        const listResponse = await fetch(`${BASE_URL}/products`);
        if (listResponse.ok) {
            const products = await listResponse.json();
            console.log(`✅ Listagem OK - ${products.data?.length || 0} produtos encontrados`);
        } else {
            console.log(`❌ Erro na listagem: ${listResponse.status}`);
        }

        // 2. Teste: Criar produto sem imagem
        console.log('\n2️⃣ Testando criação de produto sem imagem...');
        const productWithoutImage = {
            name: 'Produto Teste API',
            description: 'Produto criado via script de teste',
            price_sale: 29.99,
            cost: 15.00,
            quantity: 10
        };

        const createResponse = await fetch(`${BASE_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productWithoutImage)
        });

        if (createResponse.ok) {
            const newProduct = await createResponse.json();
            console.log(`✅ Produto criado sem imagem - ID: ${newProduct.id}`);

            // 3. Teste: Criar produto com URL de imagem
            console.log('\n3️⃣ Testando criação de produto com URL de imagem...');
            const productWithImage = {
                name: 'Produto com Imagem',
                description: 'Produto com URL de imagem do Supabase',
                price_sale: 49.99,
                cost: 25.00,
                quantity: 5,
                imageUrl: 'https://exemplo.supabase.co/storage/v1/object/public/imagens/teste.jpg'
            };

            const createWithImageResponse = await fetch(`${BASE_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productWithImage)
            });

            if (createWithImageResponse.ok) {
                const newProductWithImage = await createWithImageResponse.json();
                console.log(`✅ Produto criado com imagem - ID: ${newProductWithImage.id}`);
            } else {
                const error = await createWithImageResponse.text();
                console.log(`❌ Erro ao criar produto com imagem: ${createWithImageResponse.status} - ${error}`);
            }

        } else {
            const error = await createResponse.text();
            console.log(`❌ Erro ao criar produto: ${createResponse.status} - ${error}`);
        }

        // 4. Teste: Listar produtos novamente
        console.log('\n4️⃣ Verificando produtos após criação...');
        const finalListResponse = await fetch(`${BASE_URL}/products`);
        if (finalListResponse.ok) {
            const finalProducts = await finalListResponse.json();
            console.log(`✅ Listagem final - ${finalProducts.data?.length || 0} produtos encontrados`);

            // Mostrar detalhes dos produtos
            if (finalProducts.data && finalProducts.data.length > 0) {
                console.log('\n📋 Produtos encontrados:');
                finalProducts.data.forEach((product, index) => {
                    console.log(`  ${index + 1}. ${product.name} - R$ ${product.price_sale} (${product.quantity} em estoque)`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Erro geral no teste:', error.message);
    }

    console.log('\n🎉 Teste concluído!');
}

// Executar teste
testAPI();
