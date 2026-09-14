// controllers/procurementController.js
import db from '../config/db.js';

// ============================================
// CATEGORIES & SUBCATEGORIES
// ============================================



// Helper function to safely parse JSON
const safeParseJSON = (value, fallback = []) => {
  if (!value) return fallback;
  
  // If it's already an array or object, return it
  if (typeof value === 'object') return value;
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Check if it looks like JSON (starts with [ or {)
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        console.warn('Failed to parse JSON:', trimmed);
        return fallback;
      }
    }
    
    // It's a plain string (like a single filename), wrap in array
    return [trimmed];
  }
  
  return fallback;
};

// Get all categories with subcategories
export const getCategories = async (req, res) => {
  try {
    const [categories] = await db.query(`
      SELECT * FROM procurement_categories ORDER BY id ASC
    `);

    const [subcategories] = await db.query(`
      SELECT * FROM procurement_subcategories ORDER BY name ASC
    `);

    // Group subcategories by category
    const categoriesWithSubs = categories.map(cat => ({
      ...cat,
      subcategories: subcategories.filter(sub => sub.category_id === cat.id)
    }));

    res.json({
      success: true,
      data: categoriesWithSubs
    });
  } catch (err) {
    console.error('Get Categories Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get subcategories by category
export const getSubcategories = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const [rows] = await db.query(
      `SELECT * FROM procurement_subcategories WHERE category_id = ? ORDER BY name ASC`,
      [categoryId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get Subcategories Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================
// PROCUREMENTS
// ============================================

// Get all procurements

export const getProcurements = async (req, res) => {
  try {
    const { category, subcategory, status, search } = req.query;

    let query = `
      SELECT 
        p.*,
        pc.name AS category_name,
        pc.slug AS category_slug,
        ps.name AS subcategory_name,
        ps.slug AS subcategory_slug
      FROM procurements p
      LEFT JOIN procurement_categories pc ON p.category_id = pc.id
      LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ` AND pc.slug = ?`;
      params.push(category);
    }

    if (subcategory) {
      query += ` AND ps.slug = ?`;
      params.push(subcategory);
    }

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY p.created_at DESC`;

    const [rows] = await db.query(query, params);

    // ✅ Safely parse images and attributes
    const data = rows.map(item => ({
      ...item,
      images: safeParseJSON(item.images, []),
      attributes: safeParseJSON(item.attributes, {}),
    }));

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Get Procurements Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single procurement
export const getProcurement = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(`
      SELECT 
        p.*,
        pc.name AS category_name,
        pc.slug AS category_slug,
        pc.id AS category_id,
        ps.name AS subcategory_name,
        ps.slug AS subcategory_slug,
        ps.id AS subcategory_id
      FROM procurements p
      LEFT JOIN procurement_categories pc ON p.category_id = pc.id
      LEFT JOIN procurement_subcategories ps ON p.subcategory_id = ps.id
      WHERE p.id = ?
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Procurement not found' });
    }

    const item = rows[0];
    
    // ✅ Safely parse images and attributes
    item.images = safeParseJSON(item.images, []);
    item.attributes = safeParseJSON(item.attributes, {});

    res.json({ success: true, data: item });
  } catch (err) {
    console.error('Get Procurement Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create procurement
export const createProcurement = async (req, res) => {
  try {
    const {
      category_id,
      subcategory_id,
      title,
      description,
      quantity = 1,
      value,
      market_value,
      purchase_price,
      location,
      state,
      city,
      brand,
      model,
      manufacturer,
      year,
      color,
      condition_status,
      mileage,
      chassis_number,
      serial_number,
      storage,
      screen_size,
      inches,
      capacity,
      bedrooms,
      bathrooms,
      amount,
      attributes = {}
    } = req.body;

    console.log('Create Procurement Request Body:', req.body);

    const imageFiles = req.files ? req.files.map(f => f.filename) : [];

    const [result] = await db.query(`
      INSERT INTO procurements (
        category_id, subcategory_id, title, description, quantity, available_quantity,
        value, market_value, purchase_price, location, state, city,
        brand, model, manufacturer, year, color, condition_status,
        mileage, chassis_number, serial_number, storage, screen_size, inches,
        capacity, bedrooms, bathrooms, amount, images, attributes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      category_id, subcategory_id, title, description, quantity, quantity,
      value || 0, market_value || 0, purchase_price || 0, location, state, city,
      brand, model, manufacturer, year, color, condition_status || 'New',
      mileage, chassis_number, serial_number, storage, screen_size, inches,
      capacity, bedrooms, bathrooms, amount,
      JSON.stringify(imageFiles),
      JSON.stringify(attributes),
      'available'
    ]);

    res.status(201).json({
      success: true,
      message: 'Procurement created successfully',
      data: { id: result.insertId }
    });
  } catch (err) {
    console.error('Create Procurement Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update procurement
export const updateProcurement = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle attributes
    if (updates.attributes) {
      updates.attributes = JSON.stringify(updates.attributes);
    }

    const allowedFields = [
      'category_id', 'subcategory_id', 'title', 'description', 'quantity',
      'available_quantity', 'value', 'market_value', 'purchase_price',
      'location', 'state', 'city', 'brand', 'model', 'manufacturer', 'year',
      'color', 'condition_status', 'mileage', 'chassis_number', 'serial_number',
      'storage', 'screen_size', 'inches', 'capacity', 'bedrooms', 'bathrooms',
      'amount', 'attributes', 'status'
    ];

    const updateFields = [];
    const values = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);

    await db.query(
      `UPDATE procurements SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    res.json({ success: true, message: 'Procurement updated successfully' });
  } catch (err) {
    console.error('Update Procurement Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete procurement
export const deleteProcurement = async (req, res) => {
  console.log('Delete Procurement Request Params:', req.params);
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `DELETE FROM procurements WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Procurement not found' });
    }

    res.json({ success: true, message: 'Procurement deleted successfully' });
  } catch (err) {
    console.error('Delete Procurement Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get procurement stats
export const getProcurementStats = async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(available_quantity) as available_quantity,
        SUM(value) as total_value,
        SUM(market_value) as total_market_value,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_items,
        COUNT(CASE WHEN status = 'used' THEN 1 END) as used_items
      FROM procurements
    `);

    const [categoryStats] = await db.query(`
      SELECT 
        pc.name as category_name,
        COUNT(p.id) as item_count,
        SUM(p.quantity) as total_quantity,
        SUM(p.value) as total_value
      FROM procurements p
      LEFT JOIN procurement_categories pc ON p.category_id = pc.id
      GROUP BY pc.id
    `);

    res.json({
      success: true,
      data: {
        overall: stats[0],
        by_category: categoryStats
      }
    });
  } catch (err) {
    console.error('Get Stats Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};