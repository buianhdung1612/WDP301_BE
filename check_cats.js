import mongoose from 'mongoose';
import ServiceCategory from './models/category-service.model';

async function checkCategories() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/TeddyPet'); // Assuming DB name from context earlier or typical setup
        const categories = await ServiceCategory.find({ deleted: false });
        console.log(JSON.stringify(categories, null, 2));
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

checkCategories();
