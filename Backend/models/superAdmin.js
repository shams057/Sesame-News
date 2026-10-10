module.exports=(sequelize,Datatype)=>{
    const superAdmin=sequelize.define("superAdmin",{
        login:{
            type:Datatype.STRING, 
            allowNull:false
        },
        password:{
            type:Datatype.STRING, 
            allowNull:false
        },
       
    })
    superAdmin.associate=models=>{
        superAdmin.hasMany(models.news,{
            onDelete:"cascade"
        })
        superAdmin.hasMany(models.TokenSuperAdmin,{
            onDelete:"cascade"
        })
    }
    return superAdmin
}