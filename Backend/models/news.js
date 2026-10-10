module.exports=(sequelize,Datatype)=>{
    const news=sequelize.define("news",{
        
        titre:{
            type:Datatype.STRING(50), 
            allowNull:false
        },
        description:{
            type:Datatype.TEXT,
            allowNull:true
        },
        path:{
            type:Datatype.TEXT,
            allowNull:true
        },  
        // date:{
        //     type:Datatype.DATE,
        //     allowNull:false,
        // },
        all: {
            type: Datatype.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
              
    })
    news.associate=models=>{
        news.belongsTo(models.superAdmin,{
            onDelete:"cascade",
            foreignKey: {
                allowNull: true,
              }
        })
        news.belongsTo(models.user,{
            onDelete:"cascade",
            foreignKey: {
                allowNull: true,
              }
        })   
        news.belongsTo(models.categorie,{
            onDelete:"cascade",
            foreignKey: {
                allowNull: true,
              }
        })      
       
    }
    return news
}